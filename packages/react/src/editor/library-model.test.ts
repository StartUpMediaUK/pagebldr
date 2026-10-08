import { describe, expect, it } from "vitest";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import {
  materializeBlock,
  materializeTemplate,
  thumbnailForeground,
} from "./library-model.js";
const builder = createPagebldr({
  namespace: "library-ui-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
describe("Host library factories", () => {
  it("keeps editor thumbnail labels readable without changing authored accents", () => {
    expect(thumbnailForeground("#1647e8")).toBe("#ffffff");
    expect(thumbnailForeground("#1557d6")).toBe("#ffffff");
    expect(thumbnailForeground("#fff")).toBe("#000000");
    expect(thumbnailForeground("#000")).toBe("#ffffff");
    expect(thumbnailForeground("var(--host-accent)")).toBe("var(--foreground)");
  });
  it("materializes ordinary trees with defaults, names, authored styles and independent IDs", () => {
    const tree = {
      type: "container",
      name: "Host Block",
      children: [{ type: "heading", props: { content: "Welcome" } }],
    };
    const first = materializeBlock(builder, tree);
    const second = materializeBlock(builder, tree);
    expect(first.rootId).not.toBe(second.rootId);
    expect(first.elements[first.rootId]?.name).toBe("Host Block");
    const destination = builder.documents.create({ id: "page" });
    expect(
      builder.documents.validate(
        builder.editor.dispatch(destination, {
          type: "insert",
          parentId: destination.rootId,
          index: 0,
          clipboard: first,
        }).document,
      ).valid,
    ).toBe(true);
  });
  it("materializes and clones Host Template trees into valid Documents", () => {
    const template = materializeTemplate(builder, {
      type: "container",
      children: [{ type: "heading" }],
    });
    expect(builder.documents.validate(template).valid).toBe(true);
    expect(builder.editor.library.cloneTemplate(template).rootId).not.toBe(
      template.rootId,
    );
  });
  it("rejects unknown factory Element types before mutation", () => {
    expect(() => materializeBlock(builder, { type: "missing" })).toThrow(
      "Unknown Element",
    );
  });
});
