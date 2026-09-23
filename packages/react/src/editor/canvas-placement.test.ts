import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import projectFixture from "../../../../fixtures/parity/project-enquiry.document.json";
import {
  resolveCanvasPlacement,
  resolveClickInsertion,
  resolveKeyboardMove,
} from "./canvas-placement.js";

const builder = createPagebldr({
  namespace: "placement-test",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const document = builder.documents.migrate(projectFixture);

describe("canvas placement", () => {
  it("falls back from a leaf selection to its sibling position", () => {
    expect(
      resolveClickInsertion({
        document,
        definitions: builder.elements,
        elementType: "rich-text",
        selectedId: "reference-heading-8",
      }),
    ).toMatchObject({
      position: "after",
      parentId: "reference-container-12",
      targetId: "reference-heading-8",
    });
  });

  it("allows insertion inside a compatible Container", () => {
    expect(
      resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType: "heading",
        targetId: "reference-container-7",
        position: "inside",
      }),
    ).toMatchObject({ parentId: "reference-container-7", position: "inside" });
  });

  it("rejects leaf, root-sibling, locked and circular placements", () => {
    expect(
      resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType: "heading",
        targetId: "reference-heading-8",
        position: "inside",
      }),
    ).toBeNull();
    const lockedDocument = {
      ...document,
      elements: {
        ...document.elements,
        "reference-container-7": {
          ...document.elements["reference-container-7"]!,
          locked: true,
        },
      },
    };
    expect(
      resolveCanvasPlacement({
        document: lockedDocument,
        definitions: builder.elements,
        elementType: "heading",
        targetId: "reference-container-7",
        position: "inside",
      }),
    ).toBeNull();
    expect(
      resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType: "heading",
        targetId: document.rootId,
        position: "before",
      }),
    ).toBeNull();
    expect(
      resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType: "container",
        targetId: "reference-container-6",
        position: "inside",
        movingId: "reference-container-7",
      }),
    ).toBeNull();
  });

  it("adjusts same-parent move indexes after removing the source", () => {
    expect(
      resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType: "heading",
        targetId: "reference-rich-text-9",
        position: "after",
        movingId: "reference-heading-8",
      }),
    ).toMatchObject({ parentId: "reference-container-12", index: 1 });
  });

  it("resolves keyboard sibling and nesting moves through the same policy", () => {
    expect(
      resolveKeyboardMove({
        document,
        definitions: builder.elements,
        elementId: "reference-rich-text-9",
        direction: "up",
      }),
    ).toMatchObject({ parentId: "reference-container-12", index: 0 });
    expect(
      resolveKeyboardMove({
        document,
        definitions: builder.elements,
        elementId: "reference-rich-text-9",
        direction: "in",
      }),
    ).toBeNull();
    expect(
      resolveKeyboardMove({
        document,
        definitions: builder.elements,
        elementId: "reference-heading-8",
        direction: "out",
      }),
    ).toMatchObject({
      parentId: "reference-container-14",
      targetId: "reference-container-12",
      position: "after",
    });
  });
});
