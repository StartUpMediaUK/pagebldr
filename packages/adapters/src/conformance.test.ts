import {
  createPagebldr,
  defineElement,
  type PageDocument,
} from "@pagebldr/core";
import { createPagebldrServer, type StorageAdapter } from "@pagebldr/server";
import { afterAll, describe, expect, it } from "vitest";

import { memoryAdapter } from "./memory.js";
import {
  asPagebldrPrismaClient,
  prismaMongodbAdapter,
  prismaPostgresqlAdapter,
} from "./prisma.js";

const props = {
  "~standard": {
    version: 1 as const,
    vendor: "pagebldr-test",
    validate: (value: unknown) => ({ value }),
  },
};
const builder = createPagebldr({
  namespace: "storage-conformance",
  elements: [
    defineElement({
      type: "container",
      version: 1,
      label: "Container",
      props,
      defaults: () => ({}),
    }),
  ],
});

function document(id: string, title = id): PageDocument {
  return builder.documents.create({ id, title, slug: id });
}

function conformance(name: string, createStorage: () => StorageAdapter): void {
  describe(`${name} Storage conformance`, () => {
    it("supports lifecycle, optimistic conflicts, ordered Revisions, restoration, and publication", async () => {
      let clock = 0;
      let sequence = 0;
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
        now: () => new Date(++clock * 1_000),
        createId: () => `revision-${++sequence}`,
      });
      const created = await server.documents.create({
        key: "home",
        document: document("home"),
      });
      expect(created.version).toBe(1);
      const saved = await server.documents.save({
        key: "home",
        document: { ...created.document, title: "Saved" },
        expectedVersion: 1,
      });
      expect(saved.version).toBe(2);
      await expect(
        server.documents.save({
          key: "home",
          document: saved.document,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const revisions = await server.revisions.list({ key: "home" });
      expect(revisions.map((revision) => revision.version)).toEqual([2, 1]);
      const restored = await server.revisions.restore({
        key: "home",
        revisionId: revisions[1]!.id,
        expectedVersion: 2,
      });
      expect(restored.document.title).toBe("home");
      const publication = await server.publications.publish({
        key: "home",
        revisionId: revisions[0]!.id,
      });
      expect((await server.publications.get({ key: "home" }))?.revisionId).toBe(
        publication.revisionId,
      );
      await server.publications.unpublish({ key: "home" });
      expect(await server.publications.get({ key: "home" })).toBeNull();
      await server.documents.delete({ key: "home" });
      expect(await server.documents.load({ key: "home" })).toBeNull();
      expect(await server.revisions.list({ key: "home" })).toEqual([]);
    });

    it("supports pagination and strict Scope isolation", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      for (const key of ["a", "b", "c"])
        await server.documents.create({
          scope: { workspace: "one" },
          key,
          document: document(key),
        });
      await server.documents.create({
        scope: { workspace: "two" },
        key: "a",
        document: document("other"),
      });
      const first = await server.documents.list({
        scope: { workspace: "one" },
        limit: 2,
      });
      expect(first.items.map((item) => item.key)).toEqual(["a", "b"]);
      const second = await server.documents.list({
        scope: { workspace: "one" },
        ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }),
        limit: 2,
      });
      expect(second.items.map((item) => item.key)).toEqual(["c"]);
      expect(
        (await server.documents.list({ scope: { workspace: "two" } })).items,
      ).toHaveLength(1);
    });

    it("rolls failed transactions back", async () => {
      const storage = createStorage();
      await expect(
        storage.transaction(async (tx) => {
          const now = new Date();
          await tx.documents.put({
            scope: {},
            key: "rollback",
            document: document("rollback"),
            version: 1,
            createdAt: now,
            updatedAt: now,
          });
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(
        await storage.read((tx) => tx.documents.get({}, "rollback")),
      ).toBeNull();
    });

    it("enforces single-Collection policy", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "single", key: "home" },
        revisions: { enabled: true },
      });
      await expect(
        server.documents.create({ key: "other", document: document("other") }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
}

conformance("memory", memoryAdapter);

interface GeneratedClient {
  readonly $disconnect: () => Promise<void>;
  readonly pagebldrDocument: { readonly deleteMany: () => Promise<unknown> };
  readonly pagebldrRevision: { readonly deleteMany: () => Promise<unknown> };
  readonly pagebldrPublication: { readonly deleteMany: () => Promise<unknown> };
}
interface GeneratedModule {
  readonly PrismaClient: new () => GeneratedClient;
}

const clients: GeneratedClient[] = [];
async function loadGenerated(path: string): Promise<GeneratedClient> {
  const module = (await import(path)) as GeneratedModule;
  const client = new module.PrismaClient();
  await Promise.all([
    client.pagebldrPublication.deleteMany(),
    client.pagebldrRevision.deleteMany(),
    client.pagebldrDocument.deleteMany(),
  ]);
  clients.push(client);
  return client;
}

if (process.env.PAGEBLDR_POSTGRESQL_URL) {
  const client = await loadGenerated("../generated/postgresql/index.js");
  conformance("prisma/postgresql", () =>
    prismaPostgresqlAdapter(asPagebldrPrismaClient(client)),
  );
}

if (process.env.PAGEBLDR_MONGODB_URL) {
  const client = await loadGenerated("../generated/mongodb/index.js");
  conformance("prisma/mongodb", () =>
    prismaMongodbAdapter(asPagebldrPrismaClient(client)),
  );
}

afterAll(async () => {
  await Promise.all(clients.map((client) => client.$disconnect()));
});
