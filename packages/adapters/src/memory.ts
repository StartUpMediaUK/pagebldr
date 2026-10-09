import {
  canonicalScope,
  type StorageAdapter,
  type StorageScope,
  type StorageTransaction,
  type StoredDocument,
  type StoredAudit,
  type StoredOperation,
  type StoredPublication,
  type StoredRevision,
} from "@pagebldr/server";
import { PagebldrError } from "@pagebldr/core";

interface MemoryState {
  audits: Map<string, StoredAudit>;
  operations: Map<string, StoredOperation>;
  documents: Map<string, StoredDocument>;
  revisions: Map<string, StoredRevision>;
  publications: Map<string, StoredPublication>;
}

export function memoryAdapter(): StorageAdapter<"memory", "memory"> {
  let state: MemoryState = {
    audits: new Map(),
    operations: new Map(),
    documents: new Map(),
    revisions: new Map(),
    publications: new Map(),
  };
  let queue = Promise.resolve();
  const read = <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ) => operation(createTransaction(state));
  const transaction = <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ): Promise<Result> => {
    const run = async () => {
      const draft = cloneState(state);
      const result = await operation(createTransaction(draft));
      state = draft;
      return result;
    };
    const result = queue.then(run, run);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const adapter: StorageAdapter<"memory", "memory"> = {
    integration: "memory",
    provider: "memory",
    capabilities: {
      atomicLifecycle: true,
      optimisticConcurrency: true,
      revisions: true,
      publicationPointers: true,
      pagination: true,
      scopeIsolation: true,
      transactionalAudit: true,
    },
    setup: {
      strategy: "automatic",
      summary: "No setup is required; all data is process-local and ephemeral.",
    },
    read,
    transaction,
  };
  return Object.freeze(adapter);
}

function createTransaction(state: MemoryState): StorageTransaction {
  const compound = (scope: StorageScope, id: string) =>
    `${canonicalScope(scope)}\u0000${id}`;
  return {
    audits: {
      list: (scope, documentKey) =>
        Promise.resolve(
          clone(
            [...state.audits.values()]
              .filter(
                (row) =>
                  canonicalScope(row.scope) === canonicalScope(scope) &&
                  row.documentKey === documentKey,
              )
              .sort((a, b) => a.event.sequence - b.event.sequence),
          ),
        ),
      put: (record) => {
        const key = compound(record.scope, record.event.id);
        if (
          state.audits.has(key) ||
          [...state.audits.values()].some(
            (row) =>
              canonicalScope(row.scope) === canonicalScope(record.scope) &&
              row.documentKey === record.documentKey &&
              row.event.sequence === record.event.sequence,
          )
        )
          return Promise.reject(
            new PagebldrError(
              "CONFLICT",
              "Audit identifier or sequence already exists.",
            ),
          );
        state.audits.set(key, clone(record));
        return Promise.resolve();
      },
      markDelivered: (scope, id, deliveredAt) => {
        const key = compound(scope, id);
        const row = state.audits.get(key);
        if (row)
          state.audits.set(key, { ...row, deliveredAt: clone(deliveredAt) });
        return Promise.resolve();
      },
    },
    operations: {
      deleteForDocument: (scope, documentKey) => {
        for (const [key, record] of state.operations) {
          if (
            canonicalScope(record.scope) === canonicalScope(scope) &&
            record.documentKey === documentKey
          )
            state.operations.delete(key);
        }
        return Promise.resolve();
      },
      get: (scope, id) =>
        Promise.resolve(
          clone(state.operations.get(compound(scope, id)) ?? null),
        ),
      put: (record) => {
        const key = compound(record.scope, record.id);
        if (state.operations.has(key))
          return Promise.reject(new Error("Operation receipt already exists."));
        state.operations.set(key, clone(record));
        return Promise.resolve();
      },
    },
    documents: {
      insert: (record) => {
        const key = compound(record.scope, record.key);
        if (state.documents.has(key)) return Promise.resolve(false);
        state.documents.set(key, clone(record));
        return Promise.resolve(true);
      },
      get: (scope, key) =>
        Promise.resolve(
          clone(state.documents.get(compound(scope, key)) ?? null),
        ),
      list: ({ scope, cursor, limit }) => {
        const records = [...state.documents.values()]
          .filter(
            (item) => canonicalScope(item.scope) === canonicalScope(scope),
          )
          .sort((left, right) => left.key.localeCompare(right.key));
        const start =
          cursor === undefined
            ? 0
            : Math.max(records.findIndex((item) => item.key === cursor) + 1, 0);
        const items = records.slice(start, start + limit);
        const last = items.at(-1);
        return Promise.resolve({
          items: clone(items),
          ...(start + items.length < records.length && last
            ? { nextCursor: last.key }
            : {}),
        });
      },
      put: (record) => {
        state.documents.set(compound(record.scope, record.key), clone(record));
        return Promise.resolve();
      },
      replace: (record, expectedVersion) => {
        const key = compound(record.scope, record.key);
        if (state.documents.get(key)?.version !== expectedVersion)
          return Promise.resolve(false);
        state.documents.set(key, clone(record));
        return Promise.resolve(true);
      },
      delete: (scope, key) => {
        state.documents.delete(compound(scope, key));
        return Promise.resolve();
      },
    },
    revisions: {
      get: (scope, id) =>
        Promise.resolve(
          clone(state.revisions.get(compound(scope, id)) ?? null),
        ),
      list: (scope, documentKey) =>
        Promise.resolve(
          clone(
            [...state.revisions.values()]
              .filter(
                (item) =>
                  canonicalScope(item.scope) === canonicalScope(scope) &&
                  item.documentKey === documentKey,
              )
              .sort(
                (left, right) =>
                  right.createdAt.getTime() - left.createdAt.getTime() ||
                  right.version - left.version,
              ),
          ),
        ),
      put: (record) => {
        const key = compound(record.scope, record.id);
        if (state.revisions.has(key))
          return Promise.reject(
            new PagebldrError(
              "CONFLICT",
              "Revision identifier already exists.",
            ),
          );
        state.revisions.set(key, clone(record));
        return Promise.resolve();
      },
      delete: (scope, id) => {
        state.revisions.delete(compound(scope, id));
        return Promise.resolve();
      },
    },
    publications: {
      get: (scope, key) =>
        Promise.resolve(
          clone(state.publications.get(compound(scope, key)) ?? null),
        ),
      put: (record) => {
        state.publications.set(
          compound(record.scope, record.documentKey),
          clone(record),
        );
        return Promise.resolve();
      },
      delete: (scope, key) => {
        state.publications.delete(compound(scope, key));
        return Promise.resolve();
      },
    },
  };
}

function cloneState(state: MemoryState): MemoryState {
  return {
    audits: new Map(
      [...state.audits].map(([key, value]) => [key, clone(value)]),
    ),
    operations: new Map(
      [...state.operations].map(([key, value]) => [key, clone(value)]),
    ),
    documents: new Map(
      [...state.documents].map(([key, value]) => [key, clone(value)]),
    ),
    revisions: new Map(
      [...state.revisions].map(([key, value]) => [key, clone(value)]),
    ),
    publications: new Map(
      [...state.publications].map(([key, value]) => [key, clone(value)]),
    ),
  };
}

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}
