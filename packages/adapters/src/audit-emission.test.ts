import { createPagebldr, defineElement } from "@pagebldr/core";
import {
  createEventDelivery,
  memoryEventSink,
  type EventSink,
} from "@pagebldr/runtime";
import { createPagebldrServer } from "@pagebldr/server";
import { describe, expect, it, vi } from "vitest";

import { memoryAdapter } from "./memory.js";

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (value: unknown) => ({ value }),
  },
};
const builder = createPagebldr({
  namespace: "audit-test",
  elements: [
    defineElement({
      type: "container",
      version: 1,
      label: "Container",
      props: schema,
      defaults: () => ({}),
      render: () => null,
    }),
  ],
});

describe("server Audit emission", () => {
  it("does not emit duplicate Audit events when an explicit operation is replayed", async () => {
    const sink = memoryEventSink();
    const delivery = createEventDelivery({ sink });
    const storage = memoryAdapter();
    const options = {
      builder,
      storage,
      collection: { mode: "multiple" as const },
      revisions: { enabled: true },
      audit: {
        delivery,
        context: () => ({ namespace: builder.namespace, actorId: "author" }),
      },
    };
    const server = createPagebldrServer(options);
    const document = builder.documents.create({ id: "retry-audit" });
    await server.documents.create({ key: document.id, document });
    const request = {
      key: document.id,
      document,
      expectedVersion: 1,
      operationId: "audit-once",
    };
    await server.documents.save(request);
    await createPagebldrServer(options).documents.save(request);
    await delivery.flush();
    expect(sink.events.map((event) => event.type)).toEqual([
      "document.created",
      "document.saved",
    ]);
  });
  it("emits redacted mutation events with Host Actor and Scope context", async () => {
    const sink = memoryEventSink();
    const delivery = createEventDelivery({ sink });
    const server = createPagebldrServer({
      builder,
      storage: memoryAdapter(),
      collection: { mode: "multiple" },
      revisions: { enabled: true },
      audit: {
        delivery,
        context: (request) => ({
          namespace: builder.namespace,
          actorId: "user-1",
          ...(request.scope ? { scope: request.scope } : {}),
        }),
      },
    });
    const document = builder.documents.create({ id: "home" });
    await server.documents.create({
      key: "home",
      scope: { workspace: "one" },
      document,
    });
    await server.documents.save({
      key: "home",
      scope: { workspace: "one" },
      document,
      expectedVersion: 1,
    });
    await delivery.flush();
    expect(sink.events.map((event) => event.type)).toEqual([
      "document.created",
      "document.saved",
    ]);
    expect(sink.events[0]).toMatchObject({
      context: { actorId: "user-1", scope: { workspace: "one" } },
    });
  });

  it("fails explicitly when transactional Audit is required but unavailable", () => {
    const delivery = createEventDelivery({ sink: memoryEventSink() });
    expect(() =>
      createPagebldrServer({
        builder,
        storage: {
          ...memoryAdapter(),
          capabilities: {
            ...memoryAdapter().capabilities,
            transactionalAudit: false,
          },
        },
        collection: { mode: "multiple" },
        audit: {
          delivery,
          context: () => ({ namespace: "test" }),
          requireTransactional: true,
        },
      }),
    ).toThrowError(/transactionalAudit/u);
  });
  it("persists a redacted ordered outbox and retries delivery with the same ID after restart", async () => {
    const write = vi
      .fn<EventSink["write"]>()
      .mockRejectedValue(new Error("Sink offline"));
    const storage = memoryAdapter();
    const options = {
      builder,
      storage,
      collection: { mode: "multiple" as const },
      revisions: { enabled: true },
      audit: {
        delivery: createEventDelivery({ sink: { write }, retries: 1 }),
        context: () => ({ namespace: builder.namespace }),
        requireTransactional: true,
      },
    };
    const server = createPagebldrServer(options);
    const document = builder.documents.create({ id: "outbox" });
    await server.documents.create({ key: document.id, document });
    const request = {
      key: document.id,
      document,
      expectedVersion: 1,
      operationId: "durable-audit",
    };
    await server.documents.save(request);
    const rows = await storage.read((tx) => tx.audits.list({}, document.id));
    expect(rows.map((row) => row.event.sequence)).toEqual([1, 2]);
    expect(rows.every((row) => row.deliveredAt === null)).toBe(true);
    expect(rows[1]?.event).toMatchObject({
      family: "audit",
      schemaVersion: 1,
      data: { version: 2 },
    });
    expect(JSON.stringify(rows)).not.toContain('"elements"');
    write.mockResolvedValue(undefined);
    await createPagebldrServer(options).documents.save(request);
    const delivered = await storage.read((tx) =>
      tx.audits.list({}, document.id),
    );
    expect(delivered.map((row) => row.event.id)).toEqual(
      rows.map((row) => row.event.id),
    );
    expect(delivered.every((row) => row.deliveredAt instanceof Date)).toBe(
      true,
    );
    expect(write.mock.calls.slice(-2).map(([batch]) => batch[0]!.id)).toEqual(
      rows.map((row) => row.event.id),
    );
    expect(await server.revisions.list({ key: document.id })).toHaveLength(1);
  });

  it("rolls back Document, Revision, references and receipt when the Audit append fails", async () => {
    const base = memoryAdapter();
    const storage = {
      ...base,
      transaction: <Result>(
        operation: Parameters<typeof base.transaction<Result>>[0],
      ) =>
        base.transaction((tx) =>
          operation({
            ...tx,
            audits: {
              ...tx.audits,
              put: () => Promise.reject(new Error("Audit storage failed")),
            },
          }),
        ),
    };
    const document = builder.documents.create({ id: "audit-rollback" });
    await base.transaction((tx) =>
      tx.documents.put({
        scope: {},
        key: document.id,
        document,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const sink = memoryEventSink();
    const server = createPagebldrServer({
      builder,
      storage,
      collection: { mode: "multiple" },
      revisions: { enabled: true },
      audit: {
        delivery: createEventDelivery({ sink }),
        context: () => ({ namespace: builder.namespace }),
        requireTransactional: true,
      },
    });
    await expect(
      server.publications.publish({
        key: document.id,
        document: { ...document, title: "Not committed" },
        expectedVersion: 1,
        operationId: "rollback",
      }),
    ).rejects.toThrow("Audit storage failed");
    expect(await server.documents.load({ key: document.id })).toMatchObject({
      version: 1,
      document,
    });
    expect(await server.revisions.list({ key: document.id })).toEqual([]);
    expect(await server.publications.get({ key: document.id })).toBeNull();
    expect(
      await base.read((tx) => tx.operations.get({}, "rollback")),
    ).toBeNull();
    expect(sink.events).toEqual([]);
  });
});
