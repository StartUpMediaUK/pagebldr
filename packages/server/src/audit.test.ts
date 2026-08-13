import {
  createEventDelivery,
  auditStoreEventSink,
  memoryAuditEventStore,
} from "@pagebldr/runtime";
import { describe, expect, it } from "vitest";

import { createAuditQuery } from "./audit.js";

describe("authorized Audit query", () => {
  it("leaves authorization and scope resolution with the Host", async () => {
    const store = memoryAuditEventStore();
    const delivery = createEventDelivery({ sink: auditStoreEventSink(store) });
    await delivery.audit({
      type: "document.saved",
      context: { namespace: "test", scope: { workspace: "allowed" } },
      subject: {},
      data: {},
    });
    await delivery.flush();
    const query = createAuditQuery({
      store,
      authorize: (request) => request.headers.get("authorization") === "yes",
      resolveScope: () => ({ workspace: "allowed" }),
    });
    expect((await query(new Request("https://host.test/audit"))).status).toBe(
      403,
    );
    const response = await query(
      new Request("https://host.test/audit", {
        headers: { authorization: "yes" },
      }),
    );
    expect(await response.json()).toMatchObject({
      items: [{ family: "audit" }],
    });
  });
});
