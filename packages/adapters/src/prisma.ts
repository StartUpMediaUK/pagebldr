import type {
  StorageAdapter,
  StorageListResult,
  StorageScope,
  StorageTransaction,
  StoredDocument,
  StoredAudit,
  StoredOperation,
  StoredPublication,
  StoredRevision,
} from "@pagebldr/server";
import { canonicalScope } from "@pagebldr/server";
import { PagebldrError } from "@pagebldr/core";

interface DocumentRow {
  references: unknown;
  storageId: string;
  scopeKey: string;
  scope: unknown;
  key: string;
  document: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
interface AuditRow {
  storageId: string;
  scopeKey: string;
  scope: unknown;
  documentKey: string;
  event: unknown;
  sequence: number;
  deliveredAt: Date | null;
}
interface AuditDelegate {
  findMany(args: {
    where: { scopeKey: string; documentKey: string };
    orderBy: { sequence: "asc" };
  }): Promise<AuditRow[]>;
  create(args: { data: AuditRow }): Promise<unknown>;
  updateMany(args: {
    where: { storageId: string };
    data: { deliveredAt: Date };
  }): Promise<unknown>;
}
interface OperationRow {
  storageId: string;
  scopeKey: string;
  scope: unknown;
  id: string;
  documentKey: string;
  fingerprint: string;
  response: string;
}
interface OperationDelegate {
  deleteMany(args: {
    where: { scopeKey: string; documentKey: string };
  }): Promise<unknown>;
  findUnique(args: {
    where: { storageId: string };
  }): Promise<OperationRow | null>;
  create(args: { data: OperationRow }): Promise<unknown>;
}
interface RevisionRow {
  kind: string;
  title: string;
  actorId: string | null;
  storageId: string;
  scopeKey: string;
  scope: unknown;
  id: string;
  documentKey: string;
  document: unknown;
  version: number;
  createdAt: Date;
}
interface PublicationRow {
  references: unknown;
  storageId: string;
  scopeKey: string;
  scope: unknown;
  documentKey: string;
  revisionId: string;
  publishedAt: Date;
}

interface DocumentDelegate {
  create(args: { data: DocumentRow }): Promise<unknown>;
  updateMany(args: {
    where: { storageId: string; version: number };
    data: Omit<DocumentRow, "storageId" | "createdAt">;
  }): Promise<{ count: number }>;
  findUnique(args: {
    where: { storageId: string };
  }): Promise<DocumentRow | null>;
  findMany(args: {
    where: { scopeKey: string };
    orderBy: { key: "asc" };
    take: number;
    cursor?: { storageId: string };
    skip?: number;
  }): Promise<DocumentRow[]>;
  upsert(args: {
    where: { storageId: string };
    create: DocumentRow;
    update: Omit<DocumentRow, "storageId" | "createdAt">;
  }): Promise<unknown>;
  deleteMany(args: { where: { storageId: string } }): Promise<unknown>;
}
interface RevisionDelegate {
  create(args: { data: RevisionRow }): Promise<unknown>;
  findUnique(args: {
    where: { storageId: string };
  }): Promise<RevisionRow | null>;
  findMany(args: {
    where: { scopeKey: string; documentKey: string };
    orderBy: readonly [{ createdAt: "desc" }, { version: "desc" }];
  }): Promise<RevisionRow[]>;
  deleteMany(args: { where: { storageId: string } }): Promise<unknown>;
}
interface PublicationDelegate {
  findUnique(args: {
    where: { storageId: string };
  }): Promise<PublicationRow | null>;
  upsert(args: {
    where: { storageId: string };
    create: PublicationRow;
    update: Omit<PublicationRow, "storageId">;
  }): Promise<unknown>;
  deleteMany(args: { where: { storageId: string } }): Promise<unknown>;
}

export interface PagebldrPrismaClient {
  readonly pagebldrAudit: AuditDelegate;
  readonly pagebldrOperation: OperationDelegate;
  readonly pagebldrDocument: DocumentDelegate;
  readonly pagebldrRevision: RevisionDelegate;
  readonly pagebldrPublication: PublicationDelegate;
  readonly $transaction: <Result>(
    operation: (client: PagebldrPrismaTransactionClient) => Promise<Result>,
  ) => Promise<Result>;
}
export type PagebldrPrismaTransactionClient = Omit<
  PagebldrPrismaClient,
  "$transaction"
>;

export function asPagebldrPrismaClient(client: unknown): PagebldrPrismaClient {
  if (!client || typeof client !== "object") {
    throw new TypeError("A Prisma Client instance is required.");
  }
  const candidate = client as Partial<PagebldrPrismaClient>;
  if (
    !candidate.pagebldrDocument ||
    !candidate.pagebldrRevision ||
    !candidate.pagebldrPublication ||
    !candidate.pagebldrOperation ||
    !candidate.pagebldrAudit ||
    typeof candidate.$transaction !== "function"
  ) {
    throw new TypeError(
      "Prisma Client must be generated with the pagebldr Document, Revision, Publication, Operation, and Audit models.",
    );
  }
  return candidate as PagebldrPrismaClient;
}

export function prismaPostgresqlAdapter(
  client: PagebldrPrismaClient,
): StorageAdapter<"prisma", "postgresql"> {
  return createPrismaAdapter(client, "postgresql", {
    strategy: "prisma-migrate",
    summary:
      "Add the pagebldr models to the Host Prisma PostgreSQL schema and run Prisma Migrate.",
    schemaPath: "pagebldr/adapters/prisma/postgresql.prisma",
  });
}

export function prismaMongodbAdapter(
  client: PagebldrPrismaClient,
): StorageAdapter<"prisma", "mongodb"> {
  return createPrismaAdapter(client, "mongodb", {
    strategy: "prisma-db-push",
    summary:
      "Add the pagebldr models to the Host Prisma MongoDB schema, enable a replica set, and run prisma db push.",
    schemaPath: "pagebldr/adapters/prisma/mongodb.prisma",
  });
}

function createPrismaAdapter<Provider extends "postgresql" | "mongodb">(
  client: PagebldrPrismaClient,
  provider: Provider,
  setup: StorageAdapter["setup"],
): StorageAdapter<"prisma", Provider> {
  const read = <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ): Promise<Result> => operation(createStorage(client));
  const transaction = <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ): Promise<Result> =>
    client
      .$transaction<Result>((transactionClient) =>
        operation(createStorage(transactionClient)),
      )
      .catch((error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error.code === "P2034" || error.code === "P2002")
        )
          throw new PagebldrError(
            "CONFLICT",
            "The draft changed during the transaction.",
            { cause: error },
          );
        throw error;
      });
  const adapter: StorageAdapter<"prisma", Provider> = {
    integration: "prisma",
    provider,
    capabilities: {
      atomicLifecycle: true,
      optimisticConcurrency: true,
      revisions: true,
      publicationPointers: true,
      pagination: true,
      scopeIsolation: true,
      transactionalAudit: true,
    },
    setup,
    read,
    transaction,
  };
  return Object.freeze(adapter);
}

function createStorage(
  client: PagebldrPrismaTransactionClient,
): StorageTransaction {
  const storageId = (scope: StorageScope, id: string) =>
    `${canonicalScope(scope)}::${id}`;
  return {
    audits: {
      list: async (scope, documentKey) =>
        (
          await client.pagebldrAudit.findMany({
            where: { scopeKey: canonicalScope(scope), documentKey },
            orderBy: { sequence: "asc" },
          })
        ).map((row): StoredAudit => ({
          scope: row.scope as StorageScope,
          documentKey: row.documentKey,
          event: row.event as StoredAudit["event"],
          deliveredAt: row.deliveredAt,
        })),
      put: async (record) => {
        await client.pagebldrAudit.create({
          data: {
            ...record,
            storageId: storageId(record.scope, record.event.id),
            scopeKey: canonicalScope(record.scope),
            sequence: record.event.sequence,
          },
        });
      },
      markDelivered: async (scope, id, deliveredAt) => {
        await client.pagebldrAudit.updateMany({
          where: { storageId: storageId(scope, id) },
          data: { deliveredAt },
        });
      },
    },
    operations: {
      deleteForDocument: async (scope, documentKey) => {
        await client.pagebldrOperation.deleteMany({
          where: { scopeKey: canonicalScope(scope), documentKey },
        });
      },
      get: async (scope, id): Promise<StoredOperation | null> => {
        const row = await client.pagebldrOperation.findUnique({
          where: { storageId: storageId(scope, id) },
        });
        return row
          ? {
              scope: row.scope as StorageScope,
              id: row.id,
              documentKey: row.documentKey,
              fingerprint: row.fingerprint,
              response: row.response,
            }
          : null;
      },
      put: async (record) => {
        await client.pagebldrOperation.create({
          data: {
            ...record,
            storageId: storageId(record.scope, record.id),
            scopeKey: canonicalScope(record.scope),
          },
        });
      },
    },
    documents: {
      insert: async (record) => {
        await client.pagebldrDocument.create({ data: toDocument(record) });
        return true;
      },
      get: async (scope, key) =>
        fromDocument(
          await client.pagebldrDocument.findUnique({
            where: { storageId: storageId(scope, key) },
          }),
        ),
      list: async ({ scope, cursor, limit }): Promise<StorageListResult> => {
        const rows = await client.pagebldrDocument.findMany({
          where: { scopeKey: canonicalScope(scope) },
          orderBy: { key: "asc" },
          take: limit + 1,
          ...(cursor === undefined
            ? {}
            : { cursor: { storageId: storageId(scope, cursor) }, skip: 1 }),
        });
        const hasMore = rows.length > limit;
        const items = rows
          .slice(0, limit)
          .map(fromDocument)
          .filter((item): item is StoredDocument => item !== null);
        const last = items.at(-1);
        return { items, ...(hasMore && last ? { nextCursor: last.key } : {}) };
      },
      put: async (record) => {
        const row = toDocument(record);
        await client.pagebldrDocument.upsert({
          where: { storageId: row.storageId },
          create: row,
          update: {
            scopeKey: row.scopeKey,
            scope: row.scope,
            key: row.key,
            document: row.document,
            references: row.references,
            version: row.version,
            updatedAt: row.updatedAt,
          },
        });
      },
      replace: async (record, expectedVersion) => {
        const row = toDocument(record);
        const result = await client.pagebldrDocument.updateMany({
          where: { storageId: row.storageId, version: expectedVersion },
          data: {
            scopeKey: row.scopeKey,
            scope: row.scope,
            key: row.key,
            document: row.document,
            references: row.references,
            version: row.version,
            updatedAt: row.updatedAt,
          },
        });
        return result.count === 1;
      },
      delete: async (scope, key) => {
        await client.pagebldrDocument.deleteMany({
          where: { storageId: storageId(scope, key) },
        });
      },
    },
    revisions: {
      get: async (scope, id) => {
        const row = await client.pagebldrRevision.findUnique({
          where: { storageId: storageId(scope, id) },
        });
        return row ? fromRevision(row) : null;
      },
      list: async (scope, documentKey) =>
        (
          await client.pagebldrRevision.findMany({
            where: { scopeKey: canonicalScope(scope), documentKey },
            orderBy: [{ createdAt: "desc" }, { version: "desc" }],
          })
        ).map(fromRevision),
      put: async (record) => {
        const row = toRevision(record);
        await client.pagebldrRevision.create({ data: row });
      },
      delete: async (scope, id) => {
        await client.pagebldrRevision.deleteMany({
          where: { storageId: storageId(scope, id) },
        });
      },
    },
    publications: {
      get: async (scope, key) =>
        fromPublication(
          await client.pagebldrPublication.findUnique({
            where: { storageId: storageId(scope, key) },
          }),
        ),
      put: async (record) => {
        const row = toPublication(record);
        const update = withoutStorageId(row);
        await client.pagebldrPublication.upsert({
          where: { storageId: row.storageId },
          create: row,
          update,
        });
      },
      delete: async (scope, key) => {
        await client.pagebldrPublication.deleteMany({
          where: { storageId: storageId(scope, key) },
        });
      },
    },
  };
}

const toDocument = (record: StoredDocument): DocumentRow => ({
  storageId: `${canonicalScope(record.scope)}::${record.key}`,
  scopeKey: canonicalScope(record.scope),
  scope: record.scope,
  key: record.key,
  document: record.document,
  references: record.references ?? [],
  version: record.version,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
const fromDocument = (row: DocumentRow | null): StoredDocument | null =>
  row
    ? {
        scope: row.scope as StorageScope,
        key: row.key,
        document: row.document as StoredDocument["document"],
        references: row.references as NonNullable<StoredDocument["references"]>,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;
const toRevision = (record: StoredRevision): RevisionRow => ({
  kind: record.kind,
  title: record.title,
  actorId: record.actorId,
  storageId: `${canonicalScope(record.scope)}::${record.id}`,
  scopeKey: canonicalScope(record.scope),
  scope: record.scope,
  id: record.id,
  documentKey: record.documentKey,
  document: record.document,
  version: record.version,
  createdAt: record.createdAt,
});
const fromRevision = (row: RevisionRow): StoredRevision => ({
  kind: revisionKind(row.kind),
  title: row.title || (row.document as StoredRevision["document"]).title,
  actorId: row.actorId,
  scope: row.scope as StorageScope,
  id: row.id,
  documentKey: row.documentKey,
  document: row.document as StoredRevision["document"],
  version: row.version,
  createdAt: row.createdAt,
});

function revisionKind(kind: string): StoredRevision["kind"] {
  if (kind === "save" || kind === "publish" || kind === "restore") return kind;
  throw new TypeError(`Unknown stored Revision kind: ${kind}.`);
}
const toPublication = (record: StoredPublication): PublicationRow => ({
  references: record.references ?? [],
  storageId: `${canonicalScope(record.scope)}::${record.documentKey}`,
  scopeKey: canonicalScope(record.scope),
  scope: record.scope,
  documentKey: record.documentKey,
  revisionId: record.revisionId,
  publishedAt: record.publishedAt,
});
const fromPublication = (
  row: PublicationRow | null,
): StoredPublication | null =>
  row
    ? {
        scope: row.scope as StorageScope,
        documentKey: row.documentKey,
        revisionId: row.revisionId,
        publishedAt: row.publishedAt,
        references: row.references as NonNullable<
          StoredPublication["references"]
        >,
      }
    : null;

function withoutStorageId<Row extends { storageId: string }>(
  row: Row,
): Omit<Row, "storageId"> {
  const copy: Partial<Row> = { ...row };
  delete copy.storageId;
  return copy as Omit<Row, "storageId">;
}
