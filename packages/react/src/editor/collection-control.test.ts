import { describe, expect, it } from "vitest";

import { createPagebldr, type ElementControl } from "@pagebldr/core";
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
});
