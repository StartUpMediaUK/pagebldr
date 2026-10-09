import {
  PagebldrError,
  extractDocumentReferences,
  validatePublication,
  type PublicationValidationOptions,
  type Pagebldr,
  type PageDocument,
} from "@pagebldr/core";
import type {
  AuditEventType,
  EventContext,
  EventDelivery,
} from "@pagebldr/runtime";

import type {
  StorageAdapter,
  StorageCapabilities,
  StorageScope,
  StorageTransaction,
  StoredDocument,
  StoredRevision,
} from "./storage.js";

export type CollectionPolicy =
  | { readonly mode: "single"; readonly key: string }
  | { readonly mode: "multiple" };

export interface PagebldrServerOptions<
  Adapter extends StorageAdapter = StorageAdapter,
> {
  readonly builder: Pagebldr;
  readonly storage: Adapter;
  readonly collection: CollectionPolicy;
  readonly revisions?: {
    readonly enabled: boolean;
    readonly retention?: number;
  };
  readonly requireCapabilities?: Partial<StorageCapabilities>;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly actor?: (request: DocumentRequest) => string | null;
  readonly publication?: Pick<PublicationValidationOptions, "checkReference">;
  readonly audit?: {
    readonly delivery: EventDelivery;
    readonly context: (request: DocumentRequest) => EventContext;
    readonly requireTransactional?: boolean;
  };
}

export interface DocumentRequest {
  readonly scope?: StorageScope;
  readonly key: string;
}
export interface ListRequest {
  readonly scope?: StorageScope;
  readonly cursor?: string;
  readonly limit?: number;
}
export interface CreateRequest extends DocumentRequest {
  readonly document: PageDocument;
}
export interface SaveRequest extends CreateRequest {
  readonly operationId?: string;
  readonly expectedVersion: number;
  /** Autosave advances the draft without creating a durable Revision. */
  readonly reason?: "manual" | "autosave";
}
export interface RestoreRequest extends DocumentRequest {
  readonly operationId?: string;
  readonly revisionId: string;
  readonly expectedVersion: number;
}
export interface PublishRequest extends CreateRequest {
  readonly confirmedWarnings?: readonly string[];
  readonly expectedVersion: number;
  readonly operationId?: string;
}
export interface UnpublishRequest extends DocumentRequest {
  readonly operationId?: string;
}

export function createPagebldrServer<Adapter extends StorageAdapter>(
  options: PagebldrServerOptions<Adapter>,
) {
  assertCapabilities(options.storage, options.requireCapabilities);
  if (options.audit?.requireTransactional === true)
    assertCapabilities(options.storage, { transactionalAudit: true });
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const retention =
    options.revisions?.retention ??
    (options.revisions?.enabled ? 50 : undefined);
  if (
    retention !== undefined &&
    (!Number.isSafeInteger(retention) || retention < 1)
  )
    throw new TypeError("Revision retention must be a positive safe integer.");
  const scopeOf = (scope?: StorageScope) => scope ?? {};
  const keyOf = (key: string) => {
    if (
      options.collection.mode === "single" &&
      key !== options.collection.key
    ) {
      throw new PagebldrError(
        "NOT_FOUND",
        `Collection exposes only ${options.collection.key}.`,
      );
    }
    return key;
  };

  const pruneRevisions = async (
    tx: StorageTransaction,
    record: StoredDocument,
  ) => {
    if (retention !== undefined) {
      const [revisions, publication] = await Promise.all([
        tx.revisions.list(record.scope, record.key),
        tx.publications.get(record.scope, record.key),
      ]);
      // Keep the newest snapshots plus the live snapshot when it is older.
      // A published page must never lose its immutable Revision to cleanup.
      for (const expired of revisions.slice(retention)) {
        if (expired.id !== publication?.revisionId)
          await tx.revisions.delete(record.scope, expired.id);
      }
    }
  };

  const createRevision = async (
    tx: StorageTransaction,
    record: StoredDocument,
    kind: StoredRevision["kind"],
    request: DocumentRequest,
  ): Promise<StoredRevision | null> => {
    if (options.revisions?.enabled !== true) return null;
    const revision: StoredRevision = {
      kind,
      title: record.document.title,
      actorId:
        options.actor?.(request) ??
        options.audit?.context(request).actorId ??
        null,
      scope: record.scope,
      id: createId(),
      documentKey: record.key,
      document: structuredClone(record.document),
      version: record.version,
      createdAt: now(),
    };
    await tx.revisions.put(revision);
    await pruneRevisions(tx, record);
    return revision;
  };

  const auditResult = async (
    type: AuditEventType,
    request: DocumentRequest,
    result: unknown,
    tx?: StorageTransaction,
  ) => {
    if (!options.audit) return;
    const input = {
      type,
      context: options.audit.context(request),
      subject: {
        documentKey: request.key,
        ...(type === "revision.restored" && "revisionId" in request
          ? { revisionId: String(request.revisionId) }
          : {}),
      },
      data:
        result && typeof result === "object" && "version" in result
          ? { version: Number(result.version) }
          : {},
    };
    if (tx && options.storage.capabilities.transactionalAudit) {
      const scope = scopeOf(request.scope);
      const previous = await tx.audits.list(scope, request.key);
      const event = options.audit.delivery.prepareAudit(
        input,
        (previous.at(-1)?.event.sequence ?? 0) + 1,
      );
      await tx.audits.put({
        scope,
        documentKey: request.key,
        event,
        deliveredAt: null,
      });
    } else await options.audit.delivery.audit(input);
  };

  const flushAudit = async (request: DocumentRequest, limit = 100) => {
    if (!options.audit || !options.storage.capabilities.transactionalAudit)
      return;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new TypeError("Audit delivery limit must be between 1 and 100.");
    const scope = scopeOf(request.scope);
    const pending = await options.storage.read(async (tx) =>
      (await tx.audits.list(scope, keyOf(request.key)))
        .filter((record) => record.deliveredAt === null)
        .slice(0, limit),
    );
    for (const record of pending) {
      if (!(await options.audit.delivery.deliverAudit(record.event))) break;
      await options.storage.transaction((tx) =>
        tx.audits.markDelivered(scope, record.event.id, now()),
      );
    }
  };

  const mutate = async <
    Request extends DocumentRequest & { readonly operationId?: string },
    Result,
  >(
    type: AuditEventType,
    request: Request,
    operation: (tx: StorageTransaction) => Promise<Result>,
  ): Promise<Result> => {
    const scope = scopeOf(request.scope);
    const key = keyOf(request.key);
    const id = request.operationId;
    if (
      id !== undefined &&
      (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(id))
    )
      throw new TypeError(
        "Operation ID must contain 1–128 letters, digits, underscores or hyphens.",
      );
    const fingerprint =
      id === undefined ? "" : await requestFingerprint({ type, request });
    const replay = async (tx: StorageTransaction) => {
      if (id === undefined) return null;
      const receipt = await tx.operations.get(scope, id);
      if (!receipt) return null;
      if (receipt.documentKey !== key || receipt.fingerprint !== fingerprint)
        throw new PagebldrError(
          "CONFLICT",
          "Operation ID was already used for another request.",
        );
      return {
        result: decodeResponse<Result>(receipt.response),
        replayed: true,
      };
    };
    const execute = async (
      attempt = 0,
    ): Promise<{ result: Result; replayed: boolean }> =>
      options.storage
        .transaction(async (tx) => {
          const previous = await replay(tx);
          if (previous) return previous;
          const result = await operation(tx);
          if (options.storage.capabilities.transactionalAudit)
            await auditResult(type, request, result, tx);
          if (id !== undefined)
            await tx.operations.put({
              scope,
              id,
              documentKey: key,
              fingerprint,
              response: JSON.stringify({ result }),
            });
          return { result, replayed: false };
        })
        .catch(async (error: unknown) => {
          // A concurrent identical request may have won while this transaction rolled back.
          if (isConflict(error) && id !== undefined) {
            const previous = await options.storage.read(replay);
            if (previous) return previous;
            // MongoDB can report a write conflict before the winning transaction
            // commits its receipt. Retry the exact version-checked operation only.
            // Never change expectedVersion or replace a newer head on retry.
            if (attempt < 3) {
              await new Promise<void>((resolve) =>
                setTimeout(resolve, 25 * 2 ** attempt),
              );
              return execute(attempt + 1);
            }
          }
          throw error;
        });
    const outcome = await execute();
    if (options.storage.capabilities.transactionalAudit) {
      // A delivery/ack failure must not turn a committed mutation into a failed save.
      // The Host may call audit.flush later, including after a process restart.
      await flushAudit(request).catch(() => undefined);
    } else if (!outcome.replayed)
      await auditResult(type, request, outcome.result);
    return outcome.result;
  };

  const server = Object.freeze({
    builder: options.builder,
    storage: options.storage,
    collection: options.collection,
    audit: { flush: flushAudit },
    documents: {
      load: async (request: DocumentRequest) =>
        options.storage.read((tx) =>
          tx.documents.get(scopeOf(request.scope), keyOf(request.key)),
        ),
      list: async (request: ListRequest = {}) =>
        options.storage.read((tx) =>
          tx.documents.list({
            scope: scopeOf(request.scope),
            ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
            limit: Math.min(Math.max(request.limit ?? 20, 1), 100),
          }),
        ),
      create: async (request: CreateRequest) =>
        mutate("document.created", request, async (tx) => {
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          if (await tx.documents.get(scope, key))
            throw new PagebldrError(
              "CONFLICT",
              `Document ${key} already exists.`,
            );
          const document = options.builder.documents.migrate(request.document);
          const timestamp = now();
          const record: StoredDocument = {
            scope,
            key,
            document,
            references: extractDocumentReferences(options.builder, document),
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          if (!(await tx.documents.insert(record)))
            throw new PagebldrError(
              "CONFLICT",
              "Document was created concurrently.",
            );
          // Initial load/create is not an explicit saved Revision.
          return { ...record, revision: null };
        }),
      save: async (request: SaveRequest) =>
        mutate("document.saved", request, async (tx) => {
          assertExpectedVersion(request.expectedVersion);
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          const current = await tx.documents.get(scope, key);
          if (!current)
            throw new PagebldrError(
              "NOT_FOUND",
              `Document ${key} does not exist.`,
            );
          if (current.version !== request.expectedVersion)
            throw new PagebldrError(
              "CONFLICT",
              `Document ${key} changed since version ${request.expectedVersion}.`,
              {
                details: {
                  actualVersion: current.version,
                  expectedVersion: request.expectedVersion,
                },
              },
            );
          const record: StoredDocument = {
            ...current,
            document: options.builder.documents.migrate(request.document),
            version: current.version + 1,
            updatedAt: now(),
          };
          const references = extractDocumentReferences(
            options.builder,
            record.document,
          );
          const referencedRecord = { ...record, references };
          if (
            !(await tx.documents.replace(
              referencedRecord,
              request.expectedVersion,
            ))
          )
            throw new PagebldrError(
              "CONFLICT",
              "Document changed during saving.",
            );
          const revision =
            request.reason === "autosave"
              ? null
              : await createRevision(tx, record, "save", request);
          return { ...referencedRecord, revision };
        }),
      delete: async (request: DocumentRequest) =>
        mutate("document.deleted", request, async (tx) => {
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          if (!(await tx.documents.get(scope, key)))
            throw new PagebldrError(
              "NOT_FOUND",
              `Document ${key} does not exist.`,
            );
          await tx.publications.delete(scope, key);
          await tx.operations.deleteForDocument(scope, key);
          for (const revision of await tx.revisions.list(scope, key))
            await tx.revisions.delete(scope, revision.id);
          await tx.documents.delete(scope, key);
        }),
    },
    revisions: {
      load: async (
        request: DocumentRequest & { readonly revisionId: string },
      ) =>
        options.storage.read(async (tx) => {
          const revision = await tx.revisions.get(
            scopeOf(request.scope),
            request.revisionId,
          );
          if (!revision || revision.documentKey !== keyOf(request.key))
            throw new PagebldrError("NOT_FOUND", "Revision does not exist.");
          return {
            ...revision,
            document: options.builder.documents.migrate(revision.document),
          };
        }),
      list: async (request: DocumentRequest) =>
        options.storage.read((tx) =>
          tx.revisions.list(scopeOf(request.scope), keyOf(request.key)),
        ),
      restore: async (request: RestoreRequest) =>
        mutate("revision.restored", request, async (tx) => {
          assertExpectedVersion(request.expectedVersion);
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          const [current, revision] = await Promise.all([
            tx.documents.get(scope, key),
            tx.revisions.get(scope, request.revisionId),
          ]);
          if (!current || !revision || revision.documentKey !== key)
            throw new PagebldrError(
              "NOT_FOUND",
              "Document or Revision does not exist.",
            );
          if (current.version !== request.expectedVersion)
            throw new PagebldrError(
              "CONFLICT",
              "Document changed before restoration.",
            );
          const record: StoredDocument = {
            ...current,
            document: options.builder.documents.migrate(revision.document),
            references: extractDocumentReferences(
              options.builder,
              options.builder.documents.migrate(revision.document),
            ),
            version: current.version + 1,
            updatedAt: now(),
          };
          if (!(await tx.documents.replace(record, request.expectedVersion)))
            throw new PagebldrError(
              "CONFLICT",
              "Document changed during restoration.",
            );
          const restoredRevision = await createRevision(
            tx,
            record,
            "restore",
            request,
          );
          return { ...record, revision: restoredRevision };
        }),
    },
    publications: {
      validate: (request: CreateRequest) =>
        validatePublication(options.builder, request.document, {
          ...options.publication,
          context: { scope: scopeOf(request.scope) },
        }),
      get: async (request: DocumentRequest) =>
        options.storage.read((tx) =>
          tx.publications.get(scopeOf(request.scope), keyOf(request.key)),
        ),
      publish: async (request: PublishRequest) =>
        mutate("publication.published", request, async (tx) => {
          assertExpectedVersion(request.expectedVersion);
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          const current = await tx.documents.get(scope, key);
          if (!current)
            throw new PagebldrError(
              "NOT_FOUND",
              `Document ${key} does not exist.`,
            );
          if (current.version !== request.expectedVersion)
            throw new PagebldrError(
              "CONFLICT",
              "Document changed before publication.",
            );
          const issues = await validatePublication(
            options.builder,
            request.document,
            {
              ...options.publication,
              context: { scope },
            },
          );
          if (
            issues.some(
              (issue) =>
                issue.severity === "error" ||
                !request.confirmedWarnings?.includes(issue.id),
            )
          )
            throw new PagebldrError(
              "BROKEN_REFERENCE",
              "Publication validation requires attention.",
              { details: { issues } },
            );
          const record: StoredDocument = {
            ...current,
            document: options.builder.documents.migrate(request.document),
            references: extractDocumentReferences(
              options.builder,
              options.builder.documents.migrate(request.document),
            ),
            version: current.version + 1,
            updatedAt: now(),
          };
          if (!(await tx.documents.replace(record, request.expectedVersion)))
            throw new PagebldrError(
              "CONFLICT",
              "Document changed during publication.",
            );
          const revision = await createRevision(tx, record, "publish", request);
          if (!revision)
            throw new PagebldrError(
              "CAPABILITY_UNAVAILABLE",
              "Publication requires Revisions.",
            );
          const publication = {
            scope,
            documentKey: key,
            revisionId: revision.id,
            publishedAt: now(),
            references: record.references ?? [],
          };
          await tx.publications.put(publication);
          await pruneRevisions(tx, record);
          return {
            ...publication,
            document: record.document,
            version: record.version,
            revision,
          };
        }),
      unpublish: async (request: UnpublishRequest) =>
        mutate("publication.unpublished", request, async (tx) => {
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          if (!(await tx.documents.get(scope, key)))
            throw new PagebldrError("NOT_FOUND", "Document does not exist.");
          await tx.publications.delete(scope, key);
        }),
    },
  });
  return server;
}

function assertExpectedVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new TypeError("Expected version must be a positive safe integer.");
}

function isConflict(error: unknown): boolean {
  return error instanceof PagebldrError && error.code === "CONFLICT";
}

async function requestFingerprint(input: unknown): Promise<string> {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(input)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function decodeResponse<Result>(response: string): Result {
  const envelope = JSON.parse(response) as { result?: Record<string, unknown> };
  const result = envelope.result;
  // Only server-result metadata is revived; authored Document props stay JSON.
  if (result) {
    for (const key of ["createdAt", "updatedAt", "publishedAt"]) {
      if (typeof result[key] === "string") result[key] = new Date(result[key]);
    }
    const revision = result.revision;
    if (
      revision &&
      typeof revision === "object" &&
      "createdAt" in revision &&
      typeof revision.createdAt === "string"
    )
      revision.createdAt = new Date(revision.createdAt);
  }
  return result as Result;
}

function assertCapabilities(
  storage: StorageAdapter,
  required: Partial<StorageCapabilities> | undefined,
): void {
  const baseline: Partial<StorageCapabilities> = {
    atomicLifecycle: true,
    optimisticConcurrency: true,
    revisions: true,
    publicationPointers: true,
    pagination: true,
    scopeIsolation: true,
    ...required,
  };
  for (const [capability, enabled] of Object.entries(baseline))
    if (
      enabled === true &&
      !storage.capabilities[capability as keyof StorageCapabilities]
    )
      throw new PagebldrError(
        "CAPABILITY_UNAVAILABLE",
        `${storage.integration}/${storage.provider} does not support ${capability}.`,
      );
}
