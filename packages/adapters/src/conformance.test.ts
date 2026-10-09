import {
  createPagebldr,
  defineElement,
  type PageDocument,
} from "@pagebldr/core";
import { createPagebldrServer, type StorageAdapter } from "@pagebldr/server";
import { createEventDelivery, memoryEventSink } from "@pagebldr/runtime";
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
  resources: {
    asset: {
      reference: props,
      resolve: (value) =>
        typeof value === "string" ? `/assets/${value}` : null,
    },
  },
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
    it("atomically keeps draft and live references separate through Restore and Unpublish", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "reference-lifecycle";
      const initial = document(key);
      const withReference = (value: string) => ({
        ...initial,
        settings: {
          ...initial.settings,
          seo: {
            ...initial.settings.seo,
            socialImage: { kind: "asset", value },
          },
        },
      });
      await server.documents.create({ key, document: withReference("draft") });
      const saved = await server.documents.save({
        key,
        document: withReference("saved"),
        expectedVersion: 1,
      });
      const live = await server.publications.publish({
        key,
        document: withReference("live"),
        expectedVersion: 2,
      });
      expect((await server.documents.load({ key }))?.references).toEqual([
        { kind: "asset", value: "live" },
      ]);
      expect((await server.publications.get({ key }))?.references).toEqual([
        { kind: "asset", value: "live" },
      ]);
      await server.revisions.restore({
        key,
        revisionId: saved.revision!.id,
        expectedVersion: live.version,
      });
      expect((await server.documents.load({ key }))?.references).toEqual([
        { kind: "asset", value: "saved" },
      ]);
      expect((await server.publications.get({ key }))?.references).toEqual([
        { kind: "asset", value: "live" },
      ]);
      await server.publications.unpublish({ key });
      expect(await server.publications.get({ key })).toBeNull();
      expect((await server.documents.load({ key }))?.references).toEqual([
        { kind: "asset", value: "saved" },
      ]);
    });

    it("stores immutable transactional Audit IDs and delivers them once across receipt replay", async () => {
      const storage = createStorage();
      const sink = memoryEventSink();
      const options = {
        builder,
        storage,
        collection: { mode: "multiple" as const },
        revisions: { enabled: true },
        audit: {
          delivery: createEventDelivery({ sink }),
          context: () => ({ namespace: builder.namespace }),
          requireTransactional: true,
        },
      };
      const server = createPagebldrServer(options);
      const key = "provider-audit";
      await server.documents.create({ key, document: document(key) });
      const request = {
        key,
        document: document(key),
        expectedVersion: 1,
        operationId: "provider-audit-once",
      };
      await server.documents.save(request);
      await createPagebldrServer(options).documents.save(request);
      const rows = await storage.read((tx) => tx.audits.list({}, key));
      expect(rows.map((record) => record.event.sequence)).toEqual([1, 2]);
      expect(rows.every((record) => record.deliveredAt !== null)).toBe(true);
      expect(sink.events.map((event) => event.id)).toEqual(
        rows.map((record) => record.event.id),
      );
      await expect(
        storage.transaction(async (tx) => {
          const head = (await tx.documents.get({}, key))!;
          await tx.documents.replace(
            {
              ...head,
              version: head.version + 1,
              document: {
                ...head.document,
                title: "Must roll back with Audit",
              },
            },
            head.version,
          );
          await tx.audits.put(rows[0]!);
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await server.documents.load({ key }))?.version).toBe(2);
      expect(await storage.read((tx) => tx.audits.list({}, key))).toEqual(rows);
    });
    it("never rewrites an existing Revision when an ID factory collides", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
        createId: () => "collision",
      });
      const key = "revision-collision";
      const documentValue = document(key, "Original snapshot");
      await server.documents.create({ key, document: documentValue });
      await server.documents.save({
        key,
        document: documentValue,
        expectedVersion: 1,
      });
      await expect(
        server.publications.publish({
          key,
          document: { ...documentValue, title: "Must not replace history" },
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await server.publications.get({ key })).toBeNull();
      expect((await server.documents.load({ key }))?.version).toBe(2);
      expect(
        (await server.revisions.list({ key })).map(
          (revision) => revision.document.title,
        ),
      ).toEqual(["Original snapshot"]);
    });
    it("rejects invalid publication Documents and rolls back when Revisions are disabled", async () => {
      const storage = createStorage();
      const enabled = createPagebldrServer({
        builder,
        storage,
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "invalid-publish";
      const current = await enabled.documents.create({
        key,
        document: document(key),
      });
      await expect(
        enabled.publications.publish({
          key,
          document: { ...current.document, schemaVersion: 999 },
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: "FUTURE_SCHEMA" });
      const disabled = createPagebldrServer({
        builder,
        storage,
        collection: { mode: "multiple" },
        revisions: { enabled: false },
      });
      await expect(
        disabled.publications.publish({
          key,
          document: { ...current.document, title: "Never committed" },
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
      expect(await enabled.documents.load({ key })).toMatchObject({
        version: 1,
        document: current.document,
      });
      expect(await enabled.publications.get({ key })).toBeNull();
      expect(await enabled.revisions.list({ key })).toEqual([]);
    });

    it("deletion removes operation payloads in only the selected Scope", async () => {
      const storage = createStorage();
      const server = createPagebldrServer({
        builder,
        storage,
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "delete-receipts";
      for (const scope of [
        { workspace: "delete-one" },
        { workspace: "delete-two" },
      ]) {
        await server.documents.create({ key, scope, document: document(key) });
        await server.documents.save({
          key,
          scope,
          document: document(key),
          expectedVersion: 1,
          operationId: "delete-test",
        });
      }
      await server.documents.delete({
        key,
        scope: { workspace: "delete-one" },
      });
      expect(
        await storage.read((tx) =>
          tx.operations.get({ workspace: "delete-one" }, "delete-test"),
        ),
      ).toBeNull();
      expect(
        await storage.read((tx) =>
          tx.operations.get({ workspace: "delete-two" }, "delete-test"),
        ),
      ).not.toBeNull();
    });
    it("creates no initial Revision and never overwrites a concurrent creation", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "concurrent-create";
      const results = await Promise.allSettled(
        ["One", "Two"].map((title) =>
          server.documents.create({ key, document: document(key, title) }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(
        rejected?.status === "rejected" ? rejected.reason : null,
      ).toMatchObject({ code: "CONFLICT" });
      expect(await server.revisions.list({ key })).toEqual([]);
    });

    it("keeps publication, restore and unpublish retry-safe with Revision metadata", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
        actor: () => "author-7",
      });
      const key = "retry-lifecycle";
      const initial = await server.documents.create({
        key,
        document: document(key, "Live design"),
      });
      const publishRequest = {
        key,
        document: initial.document,
        expectedVersion: 1,
        operationId: "publish-once",
      };
      const published = await server.publications.publish(publishRequest);
      expect(published.revision).toMatchObject({
        kind: "publish",
        title: "Live design",
        actorId: "author-7",
      });
      expect(await server.publications.publish(publishRequest)).toEqual(
        published,
      );
      const changed = await server.documents.save({
        key,
        document: { ...initial.document, title: "Different draft" },
        expectedVersion: 2,
        operationId: "manual-once",
      });
      expect(changed.revision).toMatchObject({
        kind: "save",
        title: "Different draft",
        actorId: "author-7",
      });
      const restoreRequest = {
        key,
        revisionId: published.revisionId,
        expectedVersion: 3,
        operationId: "restore-once",
      };
      const restored = await server.revisions.restore(restoreRequest);
      expect(restored.revision).toMatchObject({
        kind: "restore",
        title: "Live design",
        actorId: "author-7",
      });
      expect(await server.revisions.restore(restoreRequest)).toEqual(restored);
      expect((await server.publications.get({ key }))?.revisionId).toBe(
        published.revisionId,
      );
      const unpublishRequest = { key, operationId: "unpublish-once" };
      await server.publications.unpublish(unpublishRequest);
      await server.publications.unpublish(unpublishRequest);
      expect(await server.publications.get({ key })).toBeNull();
      // An old publish retry returns its original response, not a new publication.
      expect(await server.publications.publish(publishRequest)).toEqual(
        published,
      );
      expect(await server.publications.get({ key })).toBeNull();
      expect((await server.documents.load({ key }))?.version).toBe(4);
      expect(
        (await server.revisions.list({ key })).map((revision) => revision.kind),
      ).toEqual(["restore", "save", "publish"]);
    });

    it("rolls back publication when storing the successful-operation receipt fails", async () => {
      const base = createStorage();
      const storage: StorageAdapter = {
        ...base,
        transaction: (operation) =>
          base.transaction((tx) =>
            operation({
              ...tx,
              operations: {
                ...tx.operations,
                put: () => Promise.reject(new Error("Receipt storage failed")),
              },
            }),
          ),
      };
      const server = createPagebldrServer({
        builder,
        storage,
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "receipt-rollback";
      const current = await server.documents.create({
        key,
        document: document(key),
      });
      await expect(
        server.publications.publish({
          key,
          document: { ...current.document, title: "Must roll back" },
          expectedVersion: 1,
          operationId: "failed-publication",
        }),
      ).rejects.toThrow("Receipt storage failed");
      expect((await server.documents.load({ key }))?.version).toBe(1);
      expect((await server.documents.load({ key }))?.document.title).toBe(key);
      expect(await server.publications.get({ key })).toBeNull();
      expect(await server.revisions.list({ key })).toEqual([]);
      expect(
        await base.read((tx) => tx.operations.get({}, "failed-publication")),
      ).toBeNull();
    });

    it("publishing races with saves through the same version comparison", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "publish-race";
      const current = await server.documents.create({
        key,
        document: document(key),
      });
      const results = await Promise.allSettled([
        server.publications.publish({
          key,
          document: { ...current.document, title: "Published" },
          expectedVersion: 1,
        }),
        server.documents.save({
          key,
          document: { ...current.document, title: "Saved" },
          expectedVersion: 1,
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(
        rejected?.status === "rejected" ? rejected.reason : null,
      ).toMatchObject({ code: "CONFLICT" });
      expect((await server.documents.load({ key }))?.version).toBe(2);
      expect(await server.revisions.list({ key })).toHaveLength(1);
    });

    it("replays explicit save results after a lost response without another Revision", async () => {
      const storage = createStorage();
      const options = {
        builder,
        storage,
        collection: { mode: "multiple" as const },
        revisions: { enabled: true, retention: 1 },
      };
      const server = createPagebldrServer(options);
      const key = "retry-save";
      const current = await server.documents.create({
        key,
        document: document(key),
      });
      const request = {
        key,
        document: { ...current.document, title: "Saved once" },
        expectedVersion: 1,
        operationId: "save-once",
      };
      const first = await server.documents.save(request);
      await server.documents.save({
        key,
        document: { ...first.document, title: "Later work" },
        expectedVersion: 2,
      });
      // A new server instance proves this is a Storage receipt, not an in-process cache.
      const replay =
        await createPagebldrServer(options).documents.save(request);
      expect(replay).toEqual(first);
      expect(replay.createdAt).toBeInstanceOf(Date);
      expect(replay.revision?.createdAt).toBeInstanceOf(Date);
      expect((await server.documents.load({ key }))?.document.title).toBe(
        "Later work",
      );
      expect(await server.revisions.list({ key })).toHaveLength(1);
      await expect(
        server.documents.save({
          ...request,
          document: { ...request.document, title: "Different request" },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("replays concurrent identical operations once and isolates IDs by Scope", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "retry-concurrent";
      for (const workspace of ["retry-one", "retry-two"])
        await server.documents.create({
          key,
          scope: { workspace },
          document: document(key),
        });
      const request = {
        key,
        scope: { workspace: "retry-one" },
        document: document(key, "Once"),
        expectedVersion: 1,
        operationId: "same-id",
      };
      const [first, second] = await Promise.all([
        server.documents.save(request),
        server.documents.save(request),
      ]);
      expect(first).toEqual(second);
      expect(
        (await server.revisions.list({ key, scope: request.scope })).map(
          (revision) => revision.version,
        ),
      ).toEqual([2]);
      const other = await server.documents.save({
        ...request,
        scope: { workspace: "retry-two" },
      });
      expect(other.scope).toEqual({ workspace: "retry-two" });
    });

    it("publishes the submitted draft atomically and refuses a stale publication", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "atomic-publication";
      const current = await server.documents.create({
        key,
        document: document(key, "Stored draft"),
      });
      const submitted = { ...current.document, title: "Submitted design" };
      const publication = await server.publications.publish({
        key,
        document: submitted,
        expectedVersion: current.version,
      });
      expect(publication.version).toBe(2);
      expect((await server.documents.load({ key }))?.document).toEqual(
        submitted,
      );
      const revision = (await server.revisions.list({ key })).find(
        (item) => item.id === publication.revisionId,
      );
      expect(revision?.document).toEqual(submitted);
      await expect(
        server.publications.publish({
          key,
          document: current.document,
          expectedVersion: current.version,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await server.publications.get({ key })).toMatchObject({
        revisionId: publication.revisionId,
      });
      expect((await server.documents.load({ key }))?.version).toBe(2);
    });

    it("allows exactly one of two simultaneous saves from the same draft head", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "simultaneous";
      const current = await server.documents.create({
        key,
        document: document(key),
      });
      const results = await Promise.allSettled(
        ["First session", "Second session"].map((title) =>
          server.documents.save({
            key,
            expectedVersion: current.version,
            document: { ...current.document, title },
          }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(
        rejected?.status === "rejected" ? rejected.reason : null,
      ).toMatchObject({ code: "CONFLICT" });
      expect((await server.documents.load({ key }))?.version).toBe(2);
      expect(
        (await server.revisions.list({ key })).map(
          (revision) => revision.version,
        ),
      ).toEqual([2]);
    });
    it("autosaves drafts without durable Revisions and rejects stale sessions", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true },
      });
      const key = "autosave";
      const created = await server.documents.create({
        key,
        document: document(key),
      });
      const before = await server.revisions.list({ key });
      const saved = await server.documents.save({
        key,
        document: { ...created.document, title: "Local work" },
        expectedVersion: created.version,
        reason: "autosave",
      });
      expect(saved.version).toBe(2);
      expect(saved.revision).toBeNull();
      expect(await server.revisions.list({ key })).toEqual(before);
      await expect(
        server.documents.save({
          key,
          document: { ...created.document, title: "Other session" },
          expectedVersion: created.version,
          reason: "autosave",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await server.documents.load({ key }))?.document.title).toBe(
        "Local work",
      );
      const manual = await server.documents.save({
        key,
        document: saved.document,
        expectedVersion: saved.version,
      });
      expect(manual.revision?.version).toBe(3);
      expect(await server.revisions.list({ key })).toHaveLength(
        before.length + 1,
      );
    });

    it("keeps the live snapshot outside retention and restores only the draft", async () => {
      const server = createPagebldrServer({
        builder,
        storage: createStorage(),
        collection: { mode: "multiple" },
        revisions: { enabled: true, retention: 1 },
      });
      const key = "retention";
      const created = await server.documents.create({
        key,
        document: document(key, "Live"),
      });
      const live = await server.publications.publish({
        key,
        document: created.document,
        expectedVersion: created.version,
      });
      let head = (await server.documents.load({ key }))!;
      for (const title of ["Draft one", "Draft two", "Draft three"]) {
        head = await server.documents.save({
          key,
          document: { ...head.document, title },
          expectedVersion: head.version,
        });
      }
      const retained = await server.revisions.list({ key });
      expect(retained.map((revision) => revision.version)).toEqual([5, 2]);
      expect(retained[1]?.id).toBe(live.revisionId);
      const restored = await server.revisions.restore({
        key,
        revisionId: live.revisionId,
        expectedVersion: head.version,
      });
      expect(restored.version).toBe(6);
      expect(restored.document.title).toBe("Live");
      expect(restored.revision?.id).not.toBe(live.revisionId);
      expect(await server.publications.get({ key })).toMatchObject({
        revisionId: live.revisionId,
      });
      expect(
        (await server.revisions.list({ key })).map(
          (revision) => revision.version,
        ),
      ).toEqual([6, 2]);
      await server.publications.unpublish({ key });
      await server.documents.save({
        key,
        document: restored.document,
        expectedVersion: restored.version,
      });
      expect(
        (await server.revisions.list({ key })).map(
          (revision) => revision.version,
        ),
      ).toEqual([7]);
    });

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
      expect(created.revision).toBeNull();
      await server.documents.save({
        key: "home",
        document: created.document,
        expectedVersion: 1,
      });
      const saved = await server.documents.save({
        key: "home",
        document: { ...created.document, title: "Saved" },
        expectedVersion: 2,
      });
      expect(saved.version).toBe(3);
      await expect(
        server.documents.save({
          key: "home",
          document: saved.document,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const revisions = await server.revisions.list({ key: "home" });
      expect(revisions.map((revision) => revision.version)).toEqual([3, 2]);
      const restored = await server.revisions.restore({
        key: "home",
        revisionId: revisions[1]!.id,
        expectedVersion: 3,
      });
      expect(restored.document.title).toBe("home");
      const publication = await server.publications.publish({
        key: "home",
        document: restored.document,
        expectedVersion: restored.version,
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
  readonly pagebldrAudit: { readonly deleteMany: () => Promise<unknown> };
  readonly pagebldrOperation: { readonly deleteMany: () => Promise<unknown> };
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
    client.pagebldrAudit.deleteMany(),
    client.pagebldrOperation.deleteMany(),
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
