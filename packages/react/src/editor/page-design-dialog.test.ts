import { describe, expect, it } from "vitest";

import { createPagebldr, type PageSettings } from "@pagebldr/core";
import { defaultPageDesign, validatePageDesign } from "./page-design-dialog.js";

describe("Page design dialog", () => {
  const settings = createPagebldr({
    namespace: "page-design-test",
  }).documents.create({ id: "page" }).settings;

  it("accepts the default bounded design", () => {
    expect(defaultPageDesign).toEqual({
      contentWidth: 1_200,
      tabletMax: 1_024,
      mobileMax: 767,
    });
    expect(validatePageDesign(settings)).toEqual([]);
  });

  it("reports bounds and breakpoint ordering before dispatch", () => {
    const invalid: PageSettings = {
      ...settings,
      contentWidth: 300,
      breakpoints: { tabletMax: 700, mobileMax: 767 },
    };
    expect(validatePageDesign(invalid)).toEqual([
      "Content width must be a whole number from 320 to 2400 pixels.",
      "Tablet maximum must be a whole number from 768 to 1200 pixels.",
      "Mobile maximum must be smaller than tablet maximum.",
    ]);
  });
});
