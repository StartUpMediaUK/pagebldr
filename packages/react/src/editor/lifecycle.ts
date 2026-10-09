import {
  PagebldrError,
  type Pagebldr,
  type PageDocument,
  type PublicationIssue,
} from "@pagebldr/core";

import {
  encodeRecovery,
  readRecovery,
  type EditorRecovery,
  type EditorRecoveryStorage,
} from "./recovery.js";

export type EditorSaveStatus =
  "saved" | "dirty" | "saving" | "failed" | "conflict";

export interface EditorLifecycleSnapshot {
  readonly status: EditorSaveStatus;
  readonly version: number;
  readonly error: unknown;
  readonly recovery: EditorRecovery | null;
  readonly recoveryError: unknown;
  readonly publishedRevisionId: string | null;
  readonly pending: "save" | "publish" | "restore" | "unpublish" | null;
  readonly readOnlyReason: string | null;
  readonly publicationIssues: readonly PublicationIssue[];
}

export interface EditorLifecycleSaveRequest {
  readonly document: PageDocument;
  readonly expectedVersion: number;
  readonly reason: "manual" | "autosave";
  readonly signal: AbortSignal;
  readonly operationId?: string;
}

export interface EditorLifecycleOptions {
  readonly builder: Pagebldr;
  readonly loaded: {
    readonly document: PageDocument;
    readonly version: number;
    readonly publishedRevisionId?: string | null;
    readonly readOnlyReason?: string | null;
  };
  readonly save: (
    request: EditorLifecycleSaveRequest,
  ) => Promise<{ readonly version: number }>;
  readonly recovery?: EditorRecoveryStorage;
  /** Accept a validated server/recovery snapshot into controlled Host state. */
  readonly onLoadDocument?: (document: PageDocument) => void;
  readonly reload?: (
    signal: AbortSignal,
  ) => Promise<{ readonly document: PageDocument; readonly version: number }>;
  readonly publication?: {
    readonly validate?: (
      document: PageDocument,
      signal: AbortSignal,
    ) => Promise<readonly PublicationIssue[]>;
    readonly publish: (
      request: EditorLifecycleMutationRequest & {
        readonly document: PageDocument;
        readonly confirmedWarnings?: readonly string[];
      },
    ) => Promise<{ readonly version: number; readonly revisionId: string }>;
    readonly unpublish: (
      request: EditorLifecycleMutationRequest,
    ) => Promise<void>;
  };
  readonly revisions?: {
    readonly list: (signal: AbortSignal) => Promise<readonly EditorRevision[]>;
    readonly preview: (
      id: string,
      signal: AbortSignal,
    ) => Promise<PageDocument>;
    readonly restore: (
      request: EditorLifecycleMutationRequest & {
        readonly revisionId: string;
      },
    ) => Promise<{ readonly version: number; readonly document: PageDocument }>;
  };
}

export interface EditorLifecycleMutationRequest {
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly signal: AbortSignal;
}

export interface EditorRevision {
  readonly id: string;
  readonly version: number;
  readonly kind: "save" | "publish" | "restore";
  readonly title: string;
  readonly actorId: string | null;
  readonly createdAt: string;
}

/**
 * Draft-save portion of the lifecycle controller. Hosts remain responsible for
 * controlled Document state; observe receives accepted Host changes, never commands.
 * A conflict preserves the latest local Document and suspends automatic writes.
 */
export function createEditorLifecycle(options: EditorLifecycleOptions) {
  if ((options.recovery || options.revisions) && !options.onLoadDocument)
    throw new TypeError(
      "Recovery and Revisions require onLoadDocument to accept controlled snapshots.",
    );
  assertVersion(options.loaded.version);
  let document = structuredClone(
    options.builder.documents.migrate(options.loaded.document),
  );
  const documentId = document.id;
  let localRevision = 0;
  let savedRevision = 0;
  let recoveryVersion = options.loaded.version;
  let recoveryError: unknown;
  let recovery: EditorRecovery | null = null;
  if (options.recovery) {
    try {
      recovery = readRecovery(options.builder, documentId, options.recovery);
    } catch (error) {
      recoveryError = error;
    }
  }
  let snapshot: EditorLifecycleSnapshot = Object.freeze({
    status: "saved",
    version: options.loaded.version,
    error: undefined,
    recovery,
    recoveryError,
    publishedRevisionId: options.loaded.publishedRevisionId ?? null,
    pending: null,
    readOnlyReason: options.loaded.readOnlyReason ?? null,
    publicationIssues: [],
  });
  let lastReason: "manual" | "autosave" = "autosave";
  let pendingManual:
    | {
        readonly document: PageDocument;
        readonly localRevision: number;
        readonly expectedVersion: number;
        readonly operationId: string;
      }
    | undefined;
  let pendingMutation:
    | {
        readonly kind: "publish" | "unpublish" | "restore";
        readonly operationId: string;
        readonly expectedVersion: number;
        readonly localRevision: number;
        readonly document: PageDocument;
        readonly revisionId?: string;
        readonly confirmedWarnings?: readonly string[];
      }
    | undefined;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let abort: AbortController | undefined;
  let disposed = false;
  let validating = false;
  let lastMutation:
    | {
        readonly kind: "publish" | "unpublish" | "restore";
        readonly revisionId?: string;
        readonly confirmedWarnings?: readonly string[];
      }
    | undefined;
  const activeOperation = () => inFlight;
  let recoveryPayload: string | undefined;

  const emit = (patch: Partial<EditorLifecycleSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  };
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const mirrorRecovery = () => {
    if (!options.recovery || snapshot.recovery) return;
    try {
      const payload = encodeRecovery(document, recoveryVersion);
      options.recovery.write(payload);
      recoveryPayload = payload;
      if (snapshot.recoveryError !== undefined)
        emit({ recoveryError: undefined });
    } catch (error) {
      emit({ recoveryError: error });
    }
  };
  const clearRecovery = () => {
    if (!options.recovery || recoveryPayload === undefined) return;
    try {
      if (options.recovery.read() === recoveryPayload)
        options.recovery.remove();
      recoveryPayload = undefined;
      if (snapshot.recoveryError !== undefined)
        emit({ recoveryError: undefined });
    } catch (error) {
      emit({ recoveryError: error });
    }
  };
  const assertActive = () => {
    if (disposed) throw new Error("Editor lifecycle has been disposed.");
  };
  const schedule = () => {
    clearTimer();
    if (
      disposed ||
      validating ||
      snapshot.recovery !== null ||
      pendingMutation !== undefined ||
      snapshot.readOnlyReason !== null ||
      inFlight ||
      snapshot.status === "conflict" ||
      localRevision === savedRevision
    )
      return;
    timer = setTimeout(() => {
      timer = undefined;
      void save("autosave").catch(() => undefined);
    }, 900);
  };
  const save = async (reason: "manual" | "autosave"): Promise<void> => {
    assertActive();
    if (snapshot.readOnlyReason) throw new Error(snapshot.readOnlyReason);
    if (validating) throw new Error("Publication validation is pending.");
    if (snapshot.recovery)
      throw new Error("Recover or discard local work before saving.");
    if (pendingMutation)
      throw new Error("Retry the uncertain lifecycle operation before saving.");
    if (snapshot.status === "conflict")
      throw new PagebldrError(
        "CONFLICT",
        "Resolve the draft conflict before saving.",
      );
    if (inFlight) {
      await inFlight;
      assertActive();
      // Manual save still creates a durable Revision even when autosave just saved.
      return save(reason);
    }
    // Resolve an uncertain explicit mutation before issuing a different save.
    if (reason === "autosave" && pendingManual) return save("manual");
    if (reason === "autosave" && localRevision === savedRevision) return;
    clearTimer();
    if (reason === "manual" && !pendingManual)
      pendingManual = {
        document: structuredClone(document),
        localRevision,
        expectedVersion: snapshot.version,
        operationId: crypto.randomUUID(),
      };
    const attempt = reason === "manual" ? pendingManual : undefined;
    const submittedRevision = attempt?.localRevision ?? localRevision;
    lastMutation = undefined;
    lastReason = reason;
    const submittedDocument = structuredClone(attempt?.document ?? document);
    const expectedVersion = attempt?.expectedVersion ?? snapshot.version;
    abort = new AbortController();
    const signal = abort.signal;
    // Install the request before notifying observers to make reentrant calls serialize.
    const operation = Promise.resolve()
      .then(async () => {
        if (disposed) return;
        const result = await options.save({
          document: submittedDocument,
          expectedVersion,
          reason,
          signal,
          ...(attempt ? { operationId: attempt.operationId } : {}),
        });
        assertVersion(result.version);
        if (result.version <= expectedVersion)
          throw new Error("A successful save must advance the server version.");
        if (disposed) return;
        if (attempt === pendingManual) pendingManual = undefined;
        savedRevision = submittedRevision;
        recoveryVersion = result.version;
        emit({
          version: result.version,
          status: localRevision === savedRevision ? "saved" : "dirty",
          error: undefined,
        });
        if (localRevision === savedRevision) clearRecovery();
        else mirrorRecovery();
      })
      .catch((error: unknown) => {
        if (!disposed)
          emit({ status: isConflict(error) ? "conflict" : "failed", error });
        throw error;
      })
      .finally(() => {
        inFlight = undefined;
        abort = undefined;
        if (!disposed) emit({ pending: null });
        // Failures need an explicit retry or a new edit; never spin on an outage.
        if (!disposed && snapshot.status === "dirty") schedule();
      });
    inFlight = operation;
    emit({ status: "saving", pending: "save", error: undefined });
    return operation;
  };

  const mutate = async (
    kind: "publish" | "unpublish" | "restore",
    revisionId?: string,
    confirmedWarnings?: readonly string[],
  ): Promise<PageDocument | null> => {
    assertActive();
    if (validating) throw new Error("Publication validation is pending.");
    if (snapshot.readOnlyReason) throw new Error(snapshot.readOnlyReason);
    if (snapshot.recovery)
      throw new Error("Recover or discard local work first.");
    if (snapshot.status === "conflict")
      throw new PagebldrError("CONFLICT", "Resolve the draft conflict first.");
    if (inFlight) {
      await inFlight;
      return mutate(kind, revisionId, confirmedWarnings);
    }
    if (pendingManual) throw new Error("Retry the uncertain Save draft first.");
    if (
      pendingMutation &&
      (pendingMutation.kind !== kind ||
        pendingMutation.revisionId !== revisionId)
    )
      throw new Error("Retry the uncertain lifecycle operation first.");
    if (!pendingMutation && kind === "restore" && snapshot.status !== "saved")
      throw new Error("Save local changes before restoring a Revision.");
    if (kind === "restore" ? !options.revisions : !options.publication)
      throw new Error("The Host has not configured this lifecycle capability.");
    lastMutation = {
      kind,
      ...(revisionId ? { revisionId } : {}),
      ...(confirmedWarnings ? { confirmedWarnings } : {}),
    };
    if (
      kind === "publish" &&
      !pendingMutation &&
      options.publication?.validate
    ) {
      const submittedRevision = localRevision;
      validating = true;
      clearTimer();
      abort = new AbortController();
      emit({ pending: "publish" });
      let issues: readonly PublicationIssue[];
      try {
        issues = await options.publication.validate(
          structuredClone(document),
          abort.signal,
        );
      } catch (error) {
        if (!disposed)
          emit({ status: isConflict(error) ? "conflict" : "failed", error });
        throw error;
      } finally {
        validating = false;
        abort = undefined;
        if (!disposed) {
          emit({ pending: null });
          schedule();
        }
      }
      if (disposed) return null;
      if (submittedRevision !== localRevision)
        return mutate(kind, revisionId, confirmedWarnings);
      emit({ publicationIssues: issues });
      if (
        issues.some(
          (issue) =>
            issue.severity === "error" ||
            !confirmedWarnings?.includes(issue.id),
        )
      )
        return null;
      emit({ publicationIssues: [] });
      // Validation yielded: another operation may have started meanwhile.
      const running = activeOperation();
      if (running) {
        await running;
        return mutate(kind, revisionId, confirmedWarnings);
      }
    }
    clearTimer();
    pendingMutation ??= {
      kind,
      operationId: crypto.randomUUID(),
      expectedVersion: snapshot.version,
      localRevision,
      document: structuredClone(document),
      ...(revisionId === undefined ? {} : { revisionId }),
      ...(confirmedWarnings === undefined
        ? {}
        : { confirmedWarnings: [...confirmedWarnings] }),
    };
    const attempt = pendingMutation;
    abort = new AbortController();
    const request = {
      expectedVersion: attempt.expectedVersion,
      operationId: attempt.operationId,
      signal: abort.signal,
    };
    let restored: PageDocument | null = null;
    const operation = Promise.resolve()
      .then(async () => {
        if (disposed) return;
        if (kind === "unpublish") {
          await options.publication!.unpublish(request);
          if (disposed) return;
          pendingMutation = undefined;
          emit({
            publishedRevisionId: null,
            status: localRevision === savedRevision ? "saved" : "dirty",
          });
          return;
        }
        const result =
          kind === "publish"
            ? await options.publication!.publish({
                ...request,
                document: structuredClone(attempt.document),
                ...(attempt.confirmedWarnings
                  ? { confirmedWarnings: attempt.confirmedWarnings }
                  : {}),
              })
            : await options.revisions!.restore({
                ...request,
                revisionId: attempt.revisionId!,
              });
        assertVersion(result.version);
        if (result.version <= attempt.expectedVersion)
          throw new Error(
            "A successful mutation must advance the server version.",
          );
        const validated =
          "document" in result
            ? options.builder.documents.migrate(result.document)
            : null;
        if (validated && validated.id !== documentId)
          throw new Error("Restoration cannot change the Document identity.");
        if (disposed) return;
        if (validated && localRevision === attempt.localRevision)
          options.onLoadDocument?.(structuredClone(validated));
        pendingMutation = undefined;
        recoveryVersion = result.version;
        savedRevision = attempt.localRevision;
        if (validated && localRevision === attempt.localRevision) {
          document = structuredClone(validated);
          restored = structuredClone(document);
        }
        emit({
          version: result.version,
          status: localRevision === savedRevision ? "saved" : "dirty",
          ...("revisionId" in result
            ? { publishedRevisionId: result.revisionId }
            : {}),
          error: undefined,
        });
        if (localRevision === savedRevision) clearRecovery();
        else mirrorRecovery();
      })
      .catch((error: unknown) => {
        if (!disposed)
          emit({ status: isConflict(error) ? "conflict" : "failed", error });
        throw error;
      })
      .finally(() => {
        inFlight = undefined;
        abort = undefined;
        if (!disposed) {
          emit({ pending: null });
          if (snapshot.status === "dirty") schedule();
        }
      });
    inFlight = operation;
    emit({ status: "saving", pending: kind, error: undefined });
    await operation;
    return restored;
  };

  return Object.freeze({
    capabilities: Object.freeze({
      publication: !!options.publication,
      revisions: !!options.revisions,
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      assertActive();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    observe: (next: PageDocument) => {
      assertActive();
      const validated = options.builder.documents.migrate(next);
      if (validated.id !== documentId)
        throw new Error("Create a new lifecycle when changing Documents.");
      if (JSON.stringify(validated) === JSON.stringify(document)) return;
      document = structuredClone(validated);
      localRevision++;
      if (snapshot.status !== "conflict" && snapshot.status !== "saving")
        emit({ status: "dirty", error: undefined });
      mirrorRecovery();
      schedule();
    },
    /** Returns validated work for the Host to accept into its controlled state. */
    recover: () => {
      assertActive();
      const candidate = snapshot.recovery;
      if (!candidate) throw new Error("No local recovery is available.");
      options.onLoadDocument?.(structuredClone(candidate.document));
      document = structuredClone(candidate.document);
      recoveryVersion = candidate.version;
      localRevision++;
      emit({
        recovery: null,
        error: undefined,
        status: candidate.version === snapshot.version ? "dirty" : "conflict",
      });
      mirrorRecovery();
      schedule();
      return structuredClone(document);
    },
    discardRecovery: () => {
      assertActive();
      if (!snapshot.recovery) return;
      if (options.recovery) {
        try {
          const stored = readRecovery(
            options.builder,
            documentId,
            options.recovery,
          );
          if (JSON.stringify(stored) === JSON.stringify(snapshot.recovery))
            options.recovery.remove();
        } catch (error) {
          emit({ recoveryError: error });
          return;
        }
      }
      emit({ recovery: null });
      if (localRevision !== savedRevision) mirrorRecovery();
      schedule();
    },
    save: () => save("manual"),
    publish: (confirmedWarnings?: readonly string[]) =>
      mutate("publish", undefined, confirmedWarnings),
    dismissPublicationIssues: () => emit({ publicationIssues: [] }),
    inspectConflict: async (signal: AbortSignal) => {
      assertActive();
      if (!options.reload)
        throw new Error("The Host has not configured conflict reload.");
      const head = await options.reload(signal);
      assertVersion(head.version);
      const validated = options.builder.documents.migrate(head.document);
      if (validated.id !== documentId) throw new Error("Another Document.");
      return { version: head.version, document: structuredClone(validated) };
    },
    unpublish: () => mutate("unpublish"),
    restore: (revisionId: string) => mutate("restore", revisionId),
    listRevisions: async (signal: AbortSignal) => {
      assertActive();
      return options.revisions ? options.revisions.list(signal) : [];
    },
    previewRevision: async (id: string, signal: AbortSignal) => {
      assertActive();
      if (!options.revisions) throw new Error("Revisions are unavailable.");
      const preview = options.builder.documents.migrate(
        await options.revisions.preview(id, signal),
      );
      if (preview.id !== documentId) throw new Error("Another Document.");
      return preview;
    },
    retry: () =>
      pendingMutation
        ? mutate(
            pendingMutation.kind,
            pendingMutation.revisionId,
            pendingMutation.confirmedWarnings,
          )
        : lastMutation && snapshot.status === "failed"
          ? mutate(
              lastMutation.kind,
              lastMutation.revisionId,
              lastMutation.confirmedWarnings,
            )
          : save(lastReason),
    /** Explicit Host resolution after displaying the newer server head. Keeps local work. */
    resolveConflict: (version: number) => {
      assertActive();
      assertVersion(version);
      if (snapshot.status !== "conflict" || inFlight)
        throw new Error("Only an idle conflicted lifecycle can be resolved.");
      if (version < snapshot.version)
        throw new Error(
          "Conflict resolution cannot decrease the server version.",
        );
      savedRevision = -1;
      pendingManual = undefined;
      pendingMutation = undefined;
      lastMutation = undefined;
      lastReason = "autosave";
      recoveryVersion = version;
      emit({ version, status: "dirty", error: undefined });
      mirrorRecovery();
      // Deliberate retry is required; merely supplying a version does not overwrite.
    },
    exportLocalDocument: () => structuredClone(document),
    dispose: () => {
      disposed = true;
      clearTimer();
      abort?.abort();
      listeners.clear();
    },
  });
}

function assertVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new TypeError("Server version must be a positive safe integer.");
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "CONFLICT"
  );
}
