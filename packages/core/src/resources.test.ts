import { describe, expect, it, vi } from "vitest";

import { createPagebldr } from "./config.js";
import { defineElement } from "./element.js";
import { resolveDocumentResources, resourceKey } from "./resources.js";
import type { StandardSchemaV1 } from "./schema.js";

const referenceSchema = {
  "~standard": {
    version: 1 as const,
    vendor: "resource-test",
    validate: (value: unknown) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Expected string" }] },
  },
};
const propsSchema: StandardSchemaV1<unknown, { value: string }> = {
  "~standard": {
    version: 1 as const,
    vendor: "resource-test",
    validate: (value: unknown) =>
      value &&
      typeof value === "object" &&
      typeof (value as { value?: unknown }).value === "string"
        ? { value: value as { value: string } }
        : { issues: [{ message: "Expected Resource props" }] },
  },
};
const image = defineElement({
  type: "image",
  version: 1,
  label: "Image",
  props: propsSchema,
  defaults: () => ({ value: "hero" }),
  references: (value) => [
    { kind: "asset", value: value.value },
    { kind: "cdn", value: value.value },
  ],
  render: () => null,
});

describe("Resource preparation", () => {
  it("resolves and deduplicates references through independent adapters", async () => {
    const asset = vi.fn((value: string) => `/assets/${value}`);
    const cdn = vi.fn((value: string) => `https://cdn.example/${value}`);
    const builder = createPagebldr({
      namespace: "resources",
      elements: [image],
      resources: {
        asset: {
          reference: referenceSchema,
          resolve: (value) => asset(value as string),
        },
        cdn: {
          reference: referenceSchema,
          resolve: (value) => cdn(value as string),
        },
      },
    });
    const base = builder.documents.create({ id: "home" });
    const document = {
      ...base,
      elements: {
        root: {
          ...base.elements.root!,
          type: "image",
          props: { value: "hero" },
        },
      },
    };
    const prepared = await resolveDocumentResources(builder, document);

    expect(
      prepared.values.get(resourceKey({ kind: "asset", value: "hero" })),
    ).toBe("/assets/hero");
    expect(
      prepared.values.get(resourceKey({ kind: "cdn", value: "hero" })),
    ).toBe("https://cdn.example/hero");
    expect(asset).toHaveBeenCalledOnce();
    expect(cdn).toHaveBeenCalledOnce();
  });

  it("fails explicitly when a referenced adapter is missing", async () => {
    const builder = createPagebldr({
      namespace: "missing-resource",
      elements: [image],
    });
    const base = builder.documents.create({ id: "home" });
    const document = {
      ...base,
      elements: {
        root: {
          ...base.elements.root!,
          type: "image",
          props: { value: "hero" },
        },
      },
    };
    await expect(
      resolveDocumentResources(builder, document),
    ).rejects.toMatchObject({ code: "BROKEN_REFERENCE" });
  });
});
