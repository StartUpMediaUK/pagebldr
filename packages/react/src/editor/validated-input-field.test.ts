import { describe, expect, it } from "vitest";
import {
  createPagebldr,
  PagebldrError,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";

import { commitInputDraft, parseNumberDraft } from "./validated-input-field.js";

describe("validated inspector drafts", () => {
  it("rejects empty, non-finite and out-of-range numeric drafts without coercing them to zero", () => {
    for (const draft of ["", " ", "NaN", "Infinity"])
      expect(() => parseNumberDraft(draft)).toThrow("Enter a number.");
    expect(() => parseNumberDraft("15", 16, 600)).toThrow("16 or more");
    expect(() => parseNumberDraft("601", 16, 600)).toThrow("600 or less");
    expect(parseNumberDraft("16", 16, 600)).toBe(16);
    expect(parseNumberDraft("600", 16, 600)).toBe(600);
    expect(parseNumberDraft("1.5")).toBe(1.5);
  });

  it("surfaces schema issues and provides a safe fallback for non-Error rejections", () => {
    expect(
      commitInputDraft("bad", () => {
        throw new PagebldrError("INVALID_ELEMENT", "Invalid props.", {
          details: {
            issues: [
              { message: "Use a valid color." },
              { message: "Use a valid color." },
            ],
          },
        });
      }),
    ).toBe("Use a valid color.");
    expect(
      commitInputDraft("bad", () => {
        // Hosts and third-party schemas can reject with non-Error values.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "rejected";
      }),
    ).toBe("This value could not be applied.");
  });

  it("keeps invalid Style commands out of Local history and accepts a corrected draft", () => {
    const builder = createPagebldr({
      namespace: "input-test",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const document = builder.documents.create({ id: "page" });
    let history = builder.editor.history.create(document);
    const commit = (value: string) => {
      history = builder.editor.history.commit(
        history,
        {
          type: "set-style",
          target: { type: "local", elementId: document.rootId },
          breakpoint: "desktop",
          state: "normal",
          property: "backgroundColor",
          value,
        },
        { coalesceKey: "style:backgroundColor" },
      );
    };
    expect(commitInputDraft("url(javascript:alert(1))", commit)).not.toBeNull();
    expect(history.present).toEqual(document);
    expect(history.past).toHaveLength(0);
    expect(commitInputDraft("#112233", commit)).toBeNull();
    expect(commitInputDraft("#223344", commit)).toBeNull();
    expect(history.past).toHaveLength(1);
    expect(
      history.present.elements[document.rootId]?.styles.desktop?.normal
        ?.backgroundColor,
    ).toBe("#223344");
  });
});
