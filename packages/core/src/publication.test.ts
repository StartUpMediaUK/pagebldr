import { describe, expect, it } from "vitest";
import { createPagebldr } from "./config.js";
import {
  standardElements,
  standardStyleCapabilities,
} from "./standard-elements.js";
import { validatePublication } from "./publication.js";

const schema = {
  "~standard": {
    version: 1 as const,
    vendor: "publication-tests",
    validate: (value: unknown) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Expected string" }] },
  },
};
const builder = createPagebldr({
  namespace: "publication-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  resources: {
    asset: {
      reference: schema,
      resolve: (value) => (value === "missing" ? null : "/image.svg"),
    },
  },
});

function imageDocument() {
  const initial = builder.documents.create({ id: "publication" });
  const definition = builder.elements.get("image")!;
  const defaults = definition.defaults();
  if (!defaults || typeof defaults !== "object")
    throw new Error("Expected image defaults.");
  return builder.editor.dispatch(initial, {
    type: "insert",
    parentId: initial.rootId,
    index: 0,
    clipboard: {
      format: "pagebldr-clipboard",
      schemaVersion: 1,
      rootId: "image",
      elements: {
        image: {
          ...initial.elements[initial.rootId]!,
          id: "image",
          type: "image",
          elementVersion: definition.version,
          name: "Managed image",
          props: {
            ...defaults,
            source: {
              type: "resource",
              reference: { kind: "asset", value: "image" },
            },
          },
          children: [],
          styles: {},
          classIds: [],
        },
      },
      classes: {},
      classOrder: [],
      variables: {},
      variableOrder: [],
    },
  }).document;
}

describe("publication validation", () => {
  it("requires managed image usage confirmation, with a decorative alternative", async () => {
    const document = imageDocument();
    expect(await validatePublication(builder, document)).toMatchObject([
      { id: "image:image-alt:alt", severity: "error", elementId: "image" },
    ]);
    const confirmed = builder.editor.dispatch(document, {
      type: "update-props",
      elementId: "image",
      patch: { altConfirmed: true },
    }).document;
    expect(await validatePublication(builder, confirmed)).toEqual([]);
    const decorative = builder.editor.dispatch(document, {
      type: "update-props",
      elementId: "image",
      patch: { decorative: true },
    }).document;
    expect(await validatePublication(builder, decorative)).toEqual([]);
  });
  it("blocks missing Resources and warns about Host-reported unpublished targets", async () => {
    const initial = builder.documents.create({ id: "publication" });
    const social = (value: string) => ({
      ...initial,
      settings: {
        ...initial.settings,
        seo: { ...initial.settings.seo, socialImage: { kind: "asset", value } },
      },
    });
    expect(await validatePublication(builder, social("missing"))).toMatchObject(
      [{ severity: "error" }],
    );
    expect(
      await validatePublication(builder, social("image"), {
        checkReference: () => Promise.resolve("unpublished"),
      }),
    ).toMatchObject([{ severity: "warning" }]);
    await expect(
      validatePublication(builder, { ...initial, schemaVersion: 999 }),
    ).rejects.toMatchObject({ code: "FUTURE_SCHEMA" });
  });
});
