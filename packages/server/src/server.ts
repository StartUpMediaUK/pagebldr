import {
  PagebldrError,
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
  readonly expectedVersion: number;
}
export interface RestoreRequest extends DocumentRequest {
  readonly revisionId: string;
  readonly expectedVersion: number;
}
export interface PublishRequest extends DocumentRequest {
  readonly revisionId?: string;
}

export function createPagebldrServer<Adapter extends StorageAdapter>(
  options: PagebldrServerOptions<Adapter>,
) {
  assertCapabilities(options.storage, options.requireCapabilities);
  if (options.audit?.requireTransactional === true)
    assertCapabilities(options.storage, { transactionalAudit: true });
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
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

  const createRevision = async (
    tx: Parameters<Parameters<Adapter["transaction"]>[0]>[0],
    record: StoredDocument,
  ): Promise<StoredRevision | null> => {
    if (options.revisions?.enabled !== true) return null;
    const revision: StoredRevision = {
      scope: record.scope,
      id: createId(),
      documentKey: record.key,
      document: structuredClone(record.document),
      version: record.version,
      createdAt: now(),
    };
    await tx.revisions.put(revision);
    const retention = options.revisions.retention;
    if (retention !== undefined) {
      const revisions = await tx.revisions.list(record.scope, record.key);
      for (const expired of revisions.slice(retention))
        await tx.revisions.delete(record.scope, expired.id);
    }
    return revision;
  };

  const server = Object.freeze({
    builder: options.builder,
    storage: options.storage,
    collection: options.collection,
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
        options.storage.transaction(async (tx) => {
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
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await tx.documents.put(record);
          const revision = await createRevision(tx, record);
          return { ...record, revision };
        }),
      save: async (request: SaveRequest) =>
        options.storage.transaction(async (tx) => {
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
          await tx.documents.put(record);
          const revision = await createRevision(tx, record);
          return { ...record, revision };
        }),
      delete: async (request: DocumentRequest) =>
        options.storage.transaction(async (tx) => {
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          if (!(await tx.documents.get(scope, key)))
            throw new PagebldrError(
              "NOT_FOUND",
              `Document ${key} does not exist.`,
            );
          await tx.publications.delete(scope, key);
          for (const revision of await tx.revisions.list(scope, key))
            await tx.revisions.delete(scope, revision.id);
          await tx.documents.delete(scope, key);
        }),
    },
    revisions: {
      list: async (request: DocumentRequest) =>
        options.storage.read((tx) =>
          tx.revisions.list(scopeOf(request.scope), keyOf(request.key)),
        ),
      restore: async (request: RestoreRequest) =>
        options.storage.transaction(async (tx) => {
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
            document: structuredClone(revision.document),
            version: current.version + 1,
            updatedAt: now(),
          };
          await tx.documents.put(record);
          const restoredRevision = await createRevision(tx, record);
          return { ...record, revision: restoredRevision };
        }),
    },
    publications: {
      get: async (request: DocumentRequest) =>
        options.storage.read((tx) =>
          tx.publications.get(scopeOf(request.scope), keyOf(request.key)),
        ),
      publish: async (request: PublishRequest) =>
        options.storage.transaction(async (tx) => {
          const scope = scopeOf(request.scope);
          const key = keyOf(request.key);
          const document = await tx.documents.get(scope, key);
          if (!document)
            throw new PagebldrError(
              "NOT_FOUND",
              `Document ${key} does not exist.`,
            );
          let revisionId = request.revisionId;
          if (revisionId === undefined)
            revisionId = (await createRevision(tx, document))?.id;
          if (!revisionId)
            throw new PagebldrError(
              "CAPABILITY_UNAVAILABLE",
              "Publication requires Revisions.",
            );
          const revision = await tx.revisions.get(scope, revisionId);
          if (!revision || revision.documentKey !== key)
            throw new PagebldrError(
              "NOT_FOUND",
              `Revision ${revisionId} does not exist.`,
            );
          const publication = {
            scope,
            documentKey: key,
            revisionId,
            publishedAt: now(),
          };
          await tx.publications.put(publication);
          return publication;
        }),
      unpublish: async (request: DocumentRequest) =>
        options.storage.transaction(async (tx) =>
          tx.publications.delete(scopeOf(request.scope), keyOf(request.key)),
        ),
    },
  });
  if (!options.audit) return server;
  const wrap =
    <Request extends DocumentRequest, Result>(
      type: AuditEventType,
      operation: (request: Request) => Promise<Result>,
    ) =>
    async (request: Request): Promise<Result> => {
      const result = await operation(request);
      await options.audit!.delivery.audit({
        type,
        context: options.audit!.context(request),
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
      });
      return result;
    };
  return Object.freeze({
    ...server,
    documents: {
      ...server.documents,
      create: wrap("document.created", server.documents.create),
      save: wrap("document.saved", server.documents.save),
      delete: wrap("document.deleted", server.documents.delete),
    },
    revisions: {
      ...server.revisions,
      restore: wrap("revision.restored", server.revisions.restore),
    },
    publications: {
      ...server.publications,
      publish: wrap("publication.published", server.publications.publish),
      unpublish: wrap("publication.unpublished", server.publications.unpublish),
    },
  });
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
