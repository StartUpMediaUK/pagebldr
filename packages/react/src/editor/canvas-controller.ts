import type { PageSettings } from "@pagebldr/core";

import type { EditorViewport } from "./context.js";

export const minimumCanvasZoom = 0.25;
export const maximumCanvasZoom = 2;
export const maximumFitZoom = 1;

export function clampCanvasZoom(value: number): number {
  return Math.min(maximumCanvasZoom, Math.max(minimumCanvasZoom, value));
}

export function stepCanvasZoom(value: number, direction: -1 | 1): number {
  return clampCanvasZoom(Math.round((value + direction * 0.1) * 10) / 10);
}

export function fitCanvasZoom(input: {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly availableWidth: number;
  readonly availableHeight: number;
  readonly gutter?: number;
}): number {
  const gutter = input.gutter ?? 32;
  const width = Math.max(1, input.availableWidth - gutter * 2);
  const height = Math.max(1, input.availableHeight - gutter * 2);
  const scale = Math.min(
    width / Math.max(1, input.canvasWidth),
    height / Math.max(1, input.canvasHeight),
    maximumFitZoom,
  );
  return Math.max(minimumCanvasZoom, scale);
}

export function canvasViewportWidth(
  viewport: EditorViewport,
  settings: PageSettings,
  availableWidth: number,
): number {
  switch (viewport) {
    case "desktop-fill":
      return Math.max(320, availableWidth);
    case "desktop":
      return Math.min(
        1_920,
        Math.max(
          1_280,
          settings.contentWidth,
          settings.breakpoints.tabletMax + 1,
        ),
      );
    case "tablet":
      return Math.min(820, settings.breakpoints.tabletMax);
    case "mobile":
      return Math.min(390, settings.breakpoints.mobileMax);
  }
}
