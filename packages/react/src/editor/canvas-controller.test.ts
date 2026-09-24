import { describe, expect, it } from "vitest";

import {
  canvasBreakpointRange,
  canvasViewportHeight,
  canvasViewportWidth,
  clampCanvasZoom,
  fitCanvasZoom,
  stepCanvasZoom,
} from "./canvas-controller.js";

const settings = {
  contentWidth: 1_200,
  showDefaultHeader: true,
  breakpoints: { tabletMax: 1_024, mobileMax: 767 },
  seo: {
    title: "",
    description: "",
    socialTitle: "",
    socialDescription: "",
    socialImage: null,
    noIndex: false,
  },
} as const;

describe("canvas controller", () => {
  it("clamps and steps zoom through the 25–200% authoring range", () => {
    expect(clampCanvasZoom(0)).toBe(0.25);
    expect(clampCanvasZoom(3)).toBe(2);
    expect(stepCanvasZoom(1, -1)).toBe(0.9);
    expect(stepCanvasZoom(1.95, 1)).toBe(2);
  });

  it("fits the page width and never enlarges past 100%", () => {
    expect(
      fitCanvasZoom({
        canvasWidth: 1_280,
        availableWidth: 960,
      }),
    ).toBe(0.7);
    expect(
      fitCanvasZoom({
        canvasWidth: 390,
        availableWidth: 1_200,
      }),
    ).toBe(1);
  });

  it("reports the visible canvas height and active responsive range", () => {
    expect(canvasViewportHeight(844, 0.5)).toBe(1_560);
    expect(canvasBreakpointRange(1_200, settings)).toBe("desktop");
    expect(canvasBreakpointRange(820, settings)).toBe("tablet");
    expect(canvasBreakpointRange(390, settings)).toBe("mobile");
  });

  it("keeps authored viewport sizes independent from shell width", () => {
    expect(canvasViewportWidth("desktop", settings, 900)).toBe(1_280);
    expect(canvasViewportWidth("desktop-fill", settings, 900)).toBe(900);
    expect(canvasViewportWidth("tablet", settings, 900)).toBe(820);
    expect(canvasViewportWidth("mobile", settings, 900)).toBe(390);
  });
});
