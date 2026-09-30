import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type ElementControl,
} from "@pagebldr/core";
import {
  createCollectionItem,
  moveCollectionItem,
} from "./collection-control.js";

type CollectionControlDefinition = Extract<
  ElementControl<Record<string, unknown>>,
  { readonly kind: "collection" }
>;

const control: CollectionControlDefinition = {
  kind: "collection",
  key: "items",
  label: "Links",
  itemLabel: "Link",
  minItems: 1,
  maxItems: 30,
  idKey: "id",
  idPrefix: "menu-item",
  defaultItem: {
    label: "New link",
    destination: {
      type: "external",
      url: "https://example.com",
      newTab: false,
    },
  },
  itemControls: [
    { kind: "text", key: "label", label: "Label" },
    {
      kind: "destination",
      key: "destination",
      label: "Destination",
      preferFirstAnchor: true,
    },
  ],
};

describe("ordered collection Content control", () => {
  it("moves an item without mutating the source array", () => {
    const items = [{ id: "one" }, { id: "two" }, { id: "three" }];

    expect(moveCollectionItem(items, 2, 1)).toEqual([
      { id: "one" },
      { id: "three" },
      { id: "two" },
    ]);
    expect(items.map(({ id }) => id)).toEqual(["one", "two", "three"]);
  });

  it("creates a fresh item and prefers the first authored anchor", () => {
    const builder = createPagebldr({ namespace: "collection-control-test" });
    const created = builder.documents.create({ id: "page", title: "Page" });
    const document = {
      ...created,
      elements: {
        root: {
          ...created.elements.root!,
          props: { anchorId: "welcome" },
        },
      },
    };

    expect(createCollectionItem(control, document, () => "new-link")).toEqual({
      id: "new-link",
      label: "New link",
      destination: { type: "anchor", elementId: "root" },
    });
  });

  it("uses the serializable fallback when no anchor exists", () => {
    const builder = createPagebldr({ namespace: "collection-control-test" });
    const document = builder.documents.create({ id: "page", title: "Page" });

    expect(createCollectionItem(control, document, () => "new-link")).toEqual({
      id: "new-link",
      label: "New link",
      destination: {
        type: "external",
        url: "https://example.com",
        newTab: false,
      },
    });
  });

  it("creates schema-valid items for the standard ordered Content editors", () => {
    const builder = createPagebldr({
      namespace: "collection-control-test",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const document = builder.documents.create({ id: "page", title: "Page" });
    const cases = [
      ["list", "items"],
      ["icon-list", "items"],
      ["accordion", "items"],
      ["tabs", "items"],
      ["social-links", "links"],
    ] as const;

    for (const [type, key] of cases) {
      const definition = builder.elements.get(type)!;
      const controls = definition.controls as readonly ElementControl<
        Record<string, unknown>
      >[];
      const control = controls.find(
        (candidate) => candidate.kind === "collection" && candidate.key === key,
      );
      expect(control).toBeDefined();
      expect(control?.kind).toBe("collection");
      if (control?.kind !== "collection") continue;
      const item = createCollectionItem(control, document, () => "new-id");
      const props = {
        ...(definition.defaults() as Record<string, unknown>),
        [key]: [item],
      };

      expect(definition.props["~standard"].validate(props)).toHaveProperty(
        "value",
      );
    }
  });
});
