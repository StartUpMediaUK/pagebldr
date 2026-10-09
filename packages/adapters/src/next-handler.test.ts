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
  it("forwards autosave, atomic publication and operation IDs without duplicate mutations", async () => {
    const server = createPagebldrServer({
      builder,
      storage: memoryAdapter(),
      collection: { mode: "multiple" },
      revisions: { enabled: true },
    });
    const scope = { workspace: "lifecycle-host" };
    const handler = createPagebldrHandler(server, {
      authorize: () => true,
      resolveScope: () => scope,
    });
    const key = "lifecycle";
    const document = builder.documents.create({ id: key });
    await server.documents.create({ key, scope, document });
    const post = (body: Readonly<Record<string, unknown>>) =>
      handler(
        new Request(`http://localhost/pagebldr/documents/${key}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: { all: ["documents", key] } },
      );
    const publish = {
      operation: "publish",
      document: { ...document, title: "Submitted" },
      expectedVersion: 1,
      operationId: "publish-id",
    };
    const first = await post(publish);
    expect(first.status).toBe(200);
    const body: unknown = await first.json();
    const repeated = await post(publish);
    expect(await repeated.json()).toEqual(body);
    const saved = await post({
      operation: "save",
      document,
      expectedVersion: 2,
      reason: "autosave",
    });
    expect(saved.status).toBe(200);
    expect(await server.revisions.list({ scope, key })).toHaveLength(1);
    const revisionId = (await server.publications.get({ scope, key }))!
      .revisionId;
    const restore = {
      operation: "restore",
      revisionId,
      expectedVersion: 3,
      operationId: "restore-id",
    };
    expect((await post(restore)).status).toBe(200);
    expect((await post(restore)).status).toBe(200);
    const unpublish = { operation: "unpublish", operationId: "unpublish-id" };
    expect((await post(unpublish)).status).toBe(204);
    expect((await post(unpublish)).status).toBe(204);
    expect(await server.publications.get({ scope, key })).toBeNull();
    expect((await server.documents.load({ scope, key }))?.version).toBe(4);
    expect(
      (await server.revisions.list({ scope, key })).map(
        (revision) => revision.kind,
      ),
    ).toEqual(["restore", "publish"]);
    expect((await post({ ...publish, operationId: 123 })).status).toBe(400);
    expect(
      (
        await post({
          operation: "save",
          document,
          expectedVersion: 4,
          reason: "unknown",
        })
      ).status,
    ).toBe(400);
  });
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
