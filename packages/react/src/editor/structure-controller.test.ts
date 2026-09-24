import { describe, expect, it } from "vitest";

import type { PageDocument } from "@pagebldr/core";

import {
  defaultExpandedStructureIds,
  hasBrokenAnchorReference,
  responsiveHiddenBreakpoints,
  structureKeyAction,
  visibleStructureRows,
} from "./structure-controller.js";

const document = {
  rootId: "root",
  elements: {
    root: { id: "root", children: ["section"], type: "page" },
    section: { id: "section", children: ["heading"], type: "section" },
    heading: { id: "heading", children: [], type: "heading" },
  },
} as unknown as PageDocument;

describe("Structure controller", () => {
  it("keeps expansion outside the Document and flattens only visible rows", () => {
    const expanded = defaultExpandedStructureIds(document);
    expect([...expanded]).toEqual(["root", "section"]);
    expect(visibleStructureRows(document, new Set(["root"]))).toEqual([
      { id: "root", depth: 0, hasChildren: true },
      { id: "section", depth: 1, hasChildren: true },
    ]);
  });

  it("uses tree-arrow semantics for traversal, expansion, and parents", () => {
    expect(
      structureKeyAction({
        document,
        expanded: new Set(["root"]),
        selectedId: "section",
        key: "ArrowRight",
      }),
    ).toEqual({ type: "expand", elementId: "section" });
    expect(
      structureKeyAction({
        document,
        expanded: new Set(["root", "section"]),
        selectedId: "heading",
        key: "ArrowLeft",
      }),
    ).toEqual({ type: "select", elementId: "section" });
    expect(
      structureKeyAction({
        document,
        expanded: new Set(["root", "section"]),
        selectedId: "section",
        key: "ArrowDown",
      }),
    ).toEqual({ type: "select", elementId: "heading" });
  });

  it("reports responsive hiding and broken internal anchors", () => {
    const element = {
      ...document.elements.heading,
      props: {
        destination: { type: "anchor", elementId: "missing" },
      },
      styles: {
        tablet: { normal: { display: "none" } },
        mobile: { normal: { display: "none" } },
      },
    } as unknown as PageDocument["elements"][string];

    expect(responsiveHiddenBreakpoints(element)).toEqual(["tablet", "mobile"]);
    expect(hasBrokenAnchorReference(element, document)).toBe(true);
    expect(
      hasBrokenAnchorReference(
        {
          ...element,
          props: { destination: { type: "anchor", elementId: "section" } },
        },
        document,
      ),
    ).toBe(false);
  });
});
