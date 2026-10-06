import { describe, expect, it } from "vitest";
import { changedColor, normalizeColor, selectionColor } from "./color-value.js";

describe("source-characterized colour editing", () => {
  it("normalizes CSS colour formats and strips alpha when disallowed", () => {
    expect(normalizeColor("red", false)).toBe("#FF0000");
    expect(normalizeColor("rgb(18, 52, 86)", false)).toBe("#123456");
    expect(normalizeColor("rgba(18, 52, 86, 0.5)", false)).toBe("#123456");
    expect(normalizeColor("rgba(18, 52, 86, 0.5)", true)).toBe(
      "rgba(18, 52, 86, 0.5)",
    );
    expect(() => normalizeColor("invalid", true)).toThrow(
      "Enter a valid colour.",
    );
    expect(() => normalizeColor("url(javascript:alert(1))", true)).toThrow();
  });
  it("does not emit an equivalent colour on opening, format switching or reselecting", () => {
    expect(changedColor("#ff0000", "rgb(255, 0, 0)", false)).toBeNull();
    expect(
      changedColor("#12345680", "rgba(18, 52, 86, 0.5019607843137255)", true),
    ).toBeNull();
    expect(changedColor("", "#123456", false)).toBe("#123456");
  });
  it("maps the selection square corners and clamps pointer coordinates", () => {
    expect(selectionColor(0, 0, 0, 1)).toBe("#FFFFFF");
    expect(selectionColor(0, 1, 0, 1)).toBe("#FF0000");
    expect(selectionColor(0, 1, 1, 1)).toBe("#000000");
    expect(selectionColor(0, 2, -1, 1)).toBe("#FF0000");
    expect(selectionColor(0, 0.5, 0.5, 1)).toBe("#8F3030");
  });
});
