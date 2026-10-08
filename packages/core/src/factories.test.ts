import { expect, expectTypeOf, it } from "vitest";
import { defineBlock, defineTemplate, type ElementTree } from "./index.js";

it("preserves factory output inference when composing Host trees", () => {
  const block = defineBlock({
    key: "hero",
    label: "Hero",
    create: () => ({ type: "heading", props: { content: "Hello" } }),
  });
  expectTypeOf(block.create()).toExtend<ElementTree>();
  const template = defineTemplate({
    key: "landing",
    label: "Landing",
    create: () => ({ type: "container", children: [block.create()] }),
  });
  expectTypeOf(template.create()).toExtend<ElementTree>();
  expect(Object.isFrozen(block)).toBe(true);
  expect(Object.isFrozen(template)).toBe(true);
});
