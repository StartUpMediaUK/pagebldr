import { describe, expect, it } from "vitest";

import { isAnchorIdDuplicate, normalizeAnchorId } from "./anchors.js";

describe("authored anchor IDs", () => {
  it("normalizes editor input to a lowercase ASCII slug", () => {
    expect(normalizeAnchorId("  Café & Pricing 2026!  ")).toBe(
      "cafe-pricing-2026",
    );
    expect(normalizeAnchorId("42 answers")).toBe("answers");
    expect(normalizeAnchorId("---")).toBe("");
    expect(normalizeAnchorId(`a${"b".repeat(100)}`)).toHaveLength(80);
  });

  it("finds duplicates while excluding the Element being edited", () => {
    const anchors = [
      { elementId: "first", anchorId: "overview" },
      { elementId: "second", anchorId: "pricing" },
      { elementId: "third", anchorId: undefined },
    ];

    expect(isAnchorIdDuplicate(anchors, "second", "overview")).toBe(true);
    expect(isAnchorIdDuplicate(anchors, "first", "overview")).toBe(false);
    expect(isAnchorIdDuplicate(anchors, "first", "")).toBe(false);
  });
});
