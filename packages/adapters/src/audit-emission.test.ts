import { createPagebldr, defineElement } from "@pagebldr/core";
import { createEventDelivery, memoryEventSink } from "@pagebldr/runtime";
import { createPagebldrServer } from "@pagebldr/server";
import { describe, expect, it } from "vitest";

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
        storage: memoryAdapter(),
        collection: { mode: "multiple" },
        audit: {
          delivery,
          context: () => ({ namespace: "test" }),
          requireTransactional: true,
        },
      }),
    ).toThrowError(/transactionalAudit/u);
  });
});
