import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageElement,
} from "@pagebldr/core";
import { createPagebldrRuntime } from "@pagebldr/runtime";
import { createPagebldrServer } from "@pagebldr/server";
import { expect, it } from "vitest";
import { memoryAdapter } from "./memory.js";

it.each(["tabs", "accordion"] as const)(
  "saves, reloads, publishes and resolves a prepared %s Document",
  async (kind) => {
    const builder = createPagebldr({
      namespace: "panel-publication",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
      resources: {
        asset: {
          reference: {
            "~standard": {
              version: 1,
              vendor: "publication-test",
              validate: (value) =>
                typeof value === "string"
                  ? { value }
                  : { issues: [{ message: "Expected an asset identity." }] },
            },
          },
          resolve: (value) =>
            typeof value === "string" ? `/assets/${value}` : null,
        },
      },
    });
    const base = builder.documents.create({ id: "panels" });
    const element = (
      id: string,
      type: string,
      children: readonly string[],
      props = {},
    ): PageElement => ({
      ...base.elements.root!,
      id,
      type,
      name: id,
      elementVersion: builder.elements.get(type)!.version,
      props: {
        ...(builder.elements.get(type)!.defaults() as Record<string, unknown>),
        ...props,
      },
      children,
    });
    const document = {
      ...base,
      elements: {
        root: { ...base.elements.root!, children: ["tabs"] },
        tabs: element(
          "tabs",
          kind === "tabs" ? "content-tabs" : "content-accordion",
          ["panel"],
        ),
        panel: element(
          "panel",
          kind === "tabs" ? "tab-panel" : "accordion-panel",
          ["image"],
          {
            [kind === "tabs" ? "label" : "question"]: "Published panel",
          },
        ),
        image: element("image", "image", [], {
          source: {
            type: "resource",
            reference: { kind: "asset", value: "image-one" },
          },
          alt: "Geometric illustration",
          altConfirmed: true,
        }),
      },
    };
    const storage = memoryAdapter();
    const server = createPagebldrServer({
      builder,
      storage,
      collection: { mode: "multiple" },
      revisions: { enabled: true },
    });
    await server.documents.create({ key: "page", document });
    const saved = await server.documents.save({
      key: "page",
      document: builder.documents.parse(JSON.parse(JSON.stringify(document))),
      expectedVersion: 1,
    });
    expect((await server.documents.load({ key: "page" }))?.document).toEqual(
      document,
    );
    const published = await server.publications.publish({
      key: "page",
      document,
      expectedVersion: saved.version,
    });
    expect(published.version).toBeGreaterThan(saved.version);
    const runtime = createPagebldrRuntime({
      builder,
      publications: {
        resolve: async () => {
          const pointer = await server.publications.get({ key: "page" });
          return pointer
            ? (
                await server.revisions.load({
                  key: "page",
                  revisionId: pointer.revisionId,
                })
              ).document
            : null;
        },
      },
    });
    const result = await runtime.resolve({ path: "/panels" });
    expect(result.status).toBe("found");
    if (result.status !== "found")
      throw new Error("Expected a published page.");
    expect(
      result.page.document.elements.panel?.props[
        kind === "tabs" ? "label" : "question"
      ],
    ).toBe("Published panel");
    expect([...result.page.resources.values.values()]).toEqual([
      "/assets/image-one",
    ]);
  },
);
