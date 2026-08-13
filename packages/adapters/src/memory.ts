import {
  canonicalScope,
  type StorageAdapter,
  type StorageScope,
  type StorageTransaction,
  type StoredDocument,
  type StoredPublication,
  type StoredRevision,
} from "@pagebldr/server";

interface MemoryState {
  documents: Map<string, StoredDocument>;
  revisions: Map<string, StoredRevision>;
  publications: Map<string, StoredPublication>;
}

export function memoryAdapter(): StorageAdapter<"memory", "memory"> {
  let state: MemoryState = {
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
    documents: {
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
        state.revisions.set(compound(record.scope, record.id), clone(record));
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
