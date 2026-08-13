import { describe, expect, it, vi } from "vitest";

import {
  auditStoreEventSink,
  callbackEventSink,
  createEventDelivery,
  memoryAuditEventStore,
  memoryEventSink,
} from "./events.js";

const context = { namespace: "test", scope: { workspace: "one" } };

describe("event delivery", () => {
  it("versions, orders, deduplicates IDs, redacts, batches, and gates Analytics consent", async () => {
    const sink = memoryEventSink();
    let id = 0;
    const delivery = createEventDelivery({
      sink,
      batchSize: 2,
      createId: () => `event-${++id}`,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      consent: (event) => event.data.allowed === true,
    });
    await delivery.audit({
      type: "document.saved",
      context: { ...context, actorId: "actor" },
      subject: { documentKey: "home" },
      data: { version: 2, content: "private", email: "private@example.com" },
    });
    await delivery.analytics({
      type: "page.visit",
      context,
      subject: { documentId: "home" },
      data: { allowed: false },
    });
    await delivery.analytics({
      type: "page.visit",
      context,
      subject: { documentId: "home" },
      data: { allowed: true },
    });
    await delivery.flush();

    expect(sink.events).toHaveLength(2);
    expect(sink.events.map(({ id, sequence }) => [id, sequence])).toEqual([
      ["event-1", 1],
      ["event-3", 3],
    ]);
    expect(sink.events[0]).toMatchObject({
      family: "audit",
      schemaVersion: 1,
      data: { version: 2 },
    });
  });

  it("retries boundedly and isolates or propagates exhausted failures", async () => {
    const write = vi.fn().mockRejectedValue(new Error("offline"));
    const isolated = createEventDelivery({
      sink: callbackEventSink(write),
      retries: 2,
    });
    await isolated.audit({
      type: "document.created",
      context,
      subject: {},
      data: {},
    });
    await isolated.flush();
    expect(write).toHaveBeenCalledTimes(3);

    const strict = createEventDelivery({
      sink: callbackEventSink(() => {
        throw new Error("offline");
      }),
      retries: 0,
      failure: "throw",
    });
    await strict.audit({
      type: "document.created",
      context,
      subject: {},
      data: {},
    });
    await expect(strict.flush()).rejects.toThrow("offline");
  });

  it("stores and queries Audit events by Host scope and cursor", async () => {
    const store = memoryAuditEventStore();
    const delivery = createEventDelivery({
      sink: auditStoreEventSink(store),
      createId: (() => {
        let id = 0;
        return () => `audit-${++id}`;
      })(),
    });
    for (const workspace of ["one", "one", "two"])
      await delivery.audit({
        type: "document.saved",
        context: { namespace: "test", scope: { workspace } },
        subject: {},
        data: {},
      });
    await delivery.flush();
    const first = await store.list({ scope: { workspace: "one" }, limit: 1 });
    const second = await store.list({
      scope: { workspace: "one" },
      ...(first.nextCursor ? { cursor: first.nextCursor } : {}),
      limit: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
  });
});
