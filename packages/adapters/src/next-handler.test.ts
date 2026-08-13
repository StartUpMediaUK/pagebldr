import { createPagebldr, defineElement } from "@pagebldr/core";
import { createPagebldrServer } from "@pagebldr/server";
import { createPagebldrHandler } from "@pagebldr/server/next";
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
  namespace: "handler-test",
  elements: [
    defineElement({
      type: "container",
      version: 1,
      label: "Container",
      props: schema,
      defaults: () => ({}),
    }),
  ],
});

describe("Host-mounted Next handler", () => {
  it("exposes the same lifecycle while the Host supplies authorization and Scope", async () => {
    const server = createPagebldrServer({
      builder,
      storage: memoryAdapter(),
      collection: { mode: "multiple" },
      revisions: { enabled: true },
      createId: () => "revision-1",
    });
    const handler = createPagebldrHandler(server, {
      authorize: (request) =>
        request.headers.get("authorization") === "allowed",
      resolveScope: () => ({ workspace: "host" }),
    });
    const forbidden = await handler(
      new Request("http://localhost/pagebldr/documents/home", {
        method: "GET",
      }),
      { params: { all: ["documents", "home"] } },
    );
    expect(forbidden.status).toBe(403);
    const document = builder.documents.create({ id: "home", title: "Home" });
    const created = await handler(
      new Request("http://localhost/pagebldr/documents/home", {
        method: "POST",
        headers: {
          authorization: "allowed",
          "content-type": "application/json",
        },
        body: JSON.stringify({ operation: "create", document }),
      }),
      { params: Promise.resolve({ all: ["documents", "home"] }) },
    );
    expect(created.status).toBe(201);
    const direct = await server.documents.load({
      scope: { workspace: "host" },
      key: "home",
    });
    const throughHandler = await handler(
      new Request("http://localhost/pagebldr/documents/home", {
        headers: { authorization: "allowed" },
      }),
      { params: { all: ["documents", "home"] } },
    );
    expect(await throughHandler.json()).toMatchObject(
      JSON.parse(JSON.stringify(direct)) as object,
    );
  });
});
