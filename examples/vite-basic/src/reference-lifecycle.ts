import type { Pagebldr, PageDocument } from "pagebldr";
import {
  createPagebldrServer,
  type StoredDocument,
  type StoredRevision,
  type StoredPublication,
  type StoredOperation,
  type StoredAudit,
  type StorageAdapter,
} from "pagebldr/server";
import { memoryAdapter } from "pagebldr/adapters/memory";
import { createEventDelivery, memoryEventSink } from "pagebldr/runtime";

interface State {
  readonly document: StoredDocument;
  readonly revisions: readonly StoredRevision[];
  readonly publication: StoredPublication | null;
  readonly operations: readonly StoredOperation[];
  readonly audits: readonly StoredAudit[];
}

/** Private Reference Host persistence: localStorage + Web Locks, not a shipped adapter. */
export function referenceLifecycle(builder: Pagebldr, initial: PageDocument) {
  const key = initial.id;
  const storageKey = `pagebldr:reference:lifecycle:v1:${key}`;
  const recoveryKey = `pagebldr:reference:recovery:v1:${key}`;
  const read = (): State | null => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const state = JSON.parse(raw) as State;
    return {
      ...state,
      document: {
        ...state.document,
        document: builder.documents.migrate(state.document.document),
        createdAt: new Date(state.document.createdAt),
        updatedAt: new Date(state.document.updatedAt),
      },
      revisions: state.revisions.map((record) => ({
        ...record,
        createdAt: new Date(record.createdAt),
      })),
      publication: state.publication
        ? {
            ...state.publication,
            publishedAt: new Date(state.publication.publishedAt),
          }
        : null,
      audits: state.audits.map((record) => ({
        ...record,
        deliveredAt: record.deliveredAt ? new Date(record.deliveredAt) : null,
      })),
    };
  };
  const current = read();
  const loaded = {
    document: current?.document.document ?? initial,
    version: current?.document.version ?? 1,
    publishedRevisionId: current?.publication?.revisionId ?? null,
  };
  const perform = async <Result>(
    kind: string,
    operation: (
      server: ReturnType<typeof createPagebldrServer>,
    ) => Promise<Result>,
  ): Promise<Result> => {
    if (!navigator.locks)
      throw new Error(
        "This local Reference Host requires Web Locks for safe multi-session persistence.",
      );
    if (sessionStorage.getItem("pagebldr:reference:offline") === "true")
      throw new Error("Reference Host is offline.");
    return navigator.locks.request(storageKey, async () => {
      const stored = read();
      const memory = memoryAdapter();
      const operations = new Map(
        (stored?.operations ?? []).map((record) => [record.id, record]),
      );
      await memory.transaction(async (tx) => {
        if (!stored) return;
        await tx.documents.put(stored.document);
        for (const record of stored.revisions) await tx.revisions.put(record);
        for (const record of stored.operations) await tx.operations.put(record);
        for (const record of stored.audits) await tx.audits.put(record);
        if (stored.publication) await tx.publications.put(stored.publication);
      });
      const storage: StorageAdapter = {
        ...memory,
        transaction: (run) =>
          memory.transaction((tx) =>
            run({
              ...tx,
              operations: {
                ...tx.operations,
                put: async (record) => {
                  await tx.operations.put(record);
                  operations.set(record.id, record);
                },
                deleteForDocument: async (scope, documentKey) => {
                  await tx.operations.deleteForDocument(scope, documentKey);
                  for (const [id, record] of operations)
                    if (record.documentKey === documentKey)
                      operations.delete(id);
                },
              },
            }),
          ),
      };
      const server = createPagebldrServer({
        builder,
        storage,
        collection: { mode: "single", key },
        revisions: { enabled: true, retention: 50 },
        actor: () => "Reference author",
        publication: {
          checkReference: (reference) =>
            Promise.resolve(
              reference.kind === "application-link" &&
                reference.value === "pricing"
                ? "unpublished"
                : "available",
            ),
        },
        audit: {
          delivery: createEventDelivery({ sink: memoryEventSink() }),
          context: () => ({
            namespace: builder.namespace,
            actorId: "Reference author",
          }),
          requireTransactional: true,
        },
      });
      if (!stored) await server.documents.create({ key, document: initial });
      const latency = Number(
        sessionStorage.getItem("pagebldr:reference:latency") ?? 350,
      );
      if (["save", "publish", "restore", "unpublish"].includes(kind))
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Number.isFinite(latency)
              ? Math.max(0, Math.min(latency, 10000))
              : 350,
          ),
        );
      const result = await operation(server);
      const state = await storage.read(async (tx): Promise<State> => ({
        document: (await tx.documents.get({}, key))!,
        revisions: await tx.revisions.list({}, key),
        publication: await tx.publications.get({}, key),
        operations: [...operations.values()],
        audits: await tx.audits.list({}, key),
      }));
      localStorage.setItem(storageKey, JSON.stringify(state));
      if (sessionStorage.getItem("pagebldr:reference:lose-response") === kind) {
        sessionStorage.removeItem("pagebldr:reference:lose-response");
        throw new Error(
          "Reference Host committed the operation but lost its response.",
        );
      }
      return result;
    });
  };
  return {
    loaded,
    recovery: {
      read: () => localStorage.getItem(recoveryKey),
      write: (payload: string) => localStorage.setItem(recoveryKey, payload),
      remove: () => localStorage.removeItem(recoveryKey),
    },
    save: (request: {
      document: PageDocument;
      expectedVersion: number;
      reason: "manual" | "autosave";
      operationId?: string;
    }) =>
      perform("save", (server) => server.documents.save({ key, ...request })),
    reload: () =>
      perform(
        "load",
        async (server) => (await server.documents.load({ key }))!,
      ),
    publication: {
      validate: (document: PageDocument) =>
        perform("validate", (server) =>
          server.publications.validate({ key, document }),
        ),
      publish: (request: {
        document: PageDocument;
        expectedVersion: number;
        operationId: string;
        confirmedWarnings?: readonly string[];
      }) =>
        perform("publish", (server) =>
          server.publications.publish({ key, ...request }),
        ),
      unpublish: (request: { operationId: string }) =>
        perform("unpublish", (server) =>
          server.publications.unpublish({ key, ...request }),
        ),
    },
    revisions: {
      list: () =>
        perform("list", async (server) =>
          (await server.revisions.list({ key })).map((record) => ({
            ...record,
            createdAt: record.createdAt.toISOString(),
          })),
        ),
      preview: (revisionId: string) =>
        perform(
          "preview",
          async (server) =>
            (await server.revisions.load({ key, revisionId })).document,
        ),
      restore: (request: {
        expectedVersion: number;
        operationId: string;
        revisionId: string;
      }) =>
        perform("restore", (server) =>
          server.revisions.restore({ key, ...request }),
        ),
    },
    published: () => {
      const state = read();
      return (
        state?.revisions.find(
          (revision) => revision.id === state.publication?.revisionId,
        )?.document ?? null
      );
    },
  };
}
