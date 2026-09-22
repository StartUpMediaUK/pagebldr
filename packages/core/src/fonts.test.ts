import { describe, expect, it } from "vitest";

import { findStandardFontFamily, standardFontFamilies } from "./fonts.js";

describe("standard font library", () => {
  it("keeps the ten approved families and recognizes legacy aliases", () => {
    expect(standardFontFamilies).toHaveLength(10);
    expect(findStandardFontFamily("Geist, Arial, sans-serif")?.label).toBe(
      "Geist",
    );
    expect(findStandardFontFamily("Comic Sans MS")).toBeNull();
  });
});
