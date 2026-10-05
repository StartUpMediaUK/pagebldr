import { describe, expect, it } from "vitest";

import type { ElementControl } from "@pagebldr/core";

import { isPropertyControlVisible } from "./editor-shell.js";

const control = (
  visibleWhen?: ElementControl<Record<string, unknown>>["visibleWhen"],
): ElementControl<Record<string, unknown>> => ({
  kind: "text",
  key: "value",
  label: "Value",
  ...(visibleWhen ? { visibleWhen } : {}),
});

describe("property control presentation", () => {
  it("shows unconditional and matching definition-owned controls", () => {
    expect(isPropertyControlVisible(control(), {})).toBe(true);
    expect(
      isPropertyControlVisible(
        control({ key: "display", equals: "image-text" }),
        { display: "image-text" },
      ),
    ).toBe(true);
    expect(
      isPropertyControlVisible(control({ key: "display", notEquals: "text" }), {
        display: "image",
      }),
    ).toBe(true);
  });

  it("hides controls whose definition-owned condition does not match", () => {
    expect(
      isPropertyControlVisible(
        control({ key: "display", equals: "image-text" }),
        { display: "image" },
      ),
    ).toBe(false);
    expect(
      isPropertyControlVisible(control({ key: "display", notEquals: "text" }), {
        display: "text",
      }),
    ).toBe(false);
  });

  it("requires every condition when a control declares dependent states", () => {
    const dependent = control([
      { key: "collapseAt", notEquals: "never" },
      { key: "presentation", equals: "fullscreen" },
    ]);
    expect(
      isPropertyControlVisible(dependent, {
        collapseAt: "tablet",
        presentation: "fullscreen",
      }),
    ).toBe(true);
    expect(
      isPropertyControlVisible(dependent, {
        collapseAt: "never",
        presentation: "fullscreen",
      }),
    ).toBe(false);
  });
});
