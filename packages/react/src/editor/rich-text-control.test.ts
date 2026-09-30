import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type ElementControl,
} from "@pagebldr/core";
import { createRichTextBlock } from "./rich-text-control.js";

type RichTextControlDefinition = Extract<
  ElementControl<Record<string, unknown>>,
  { readonly kind: "rich-text" }
>;

describe("structured Rich Text Content control", () => {
  it("creates an independent schema-valid block from definition metadata", () => {
    const builder = createPagebldr({
      namespace: "rich-text-control-test",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const definition = builder.elements.get("rich-text")!;
    const control = definition.controls?.find(
      ({ kind }) => kind === "rich-text",
    ) as RichTextControlDefinition;

    const first = createRichTextBlock(control);
    const second = createRichTextBlock(control);
    expect(first).toEqual({ type: "paragraph", text: "" });
    expect(first).not.toBe(second);
    expect(
      definition.props["~standard"].validate({ content: [first, second] }),
    ).toHaveProperty("value");
  });
});
