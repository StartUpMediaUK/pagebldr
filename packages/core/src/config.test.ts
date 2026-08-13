import { describe, expect, it } from "vitest";

import { createPagebldr, defineElement, PagebldrError } from "./index.js";

const schema = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) => ({ value: value as { text: string } }),
    types: undefined as unknown as {
      input: { text: string };
      output: { text: string };
    },
  },
} as const;

describe("createPagebldr", () => {
  it("constructs an immutable namespace with definitions", () => {
    const text = defineElement({
      type: "text",
      version: 1,
      label: "Text",
      props: schema,
      defaults: () => ({ text: "" }),
    });
    const builder = createPagebldr({ namespace: "my-app", elements: [text] });

    expect(builder.namespace).toBe("my-app");
    expect(builder.elements.get("text")).toBe(text);
    expect(Object.isFrozen(builder)).toBe(true);
  });

  it("rejects duplicate definitions", () => {
    const text = defineElement({
      type: "text",
      version: 1,
      label: "Text",
      props: schema,
      defaults: () => ({ text: "" }),
    });

    expect(() =>
      createPagebldr({ namespace: "my-app", elements: [text, text] }),
    ).toThrowError(PagebldrError);
  });

  it("rejects invalid namespaces", () => {
    expect(() => createPagebldr({ namespace: "My App" })).toThrowError(
      "lowercase kebab-case",
    );
  });
});
