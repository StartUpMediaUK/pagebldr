import { describe, expect, it } from "vitest";
import {
  backgroundLayers,
  buildBackgroundLayers,
  parseLength,
  formatLength,
  effectValues,
  buildEffect,
} from "./style-input-values.js";

describe("composed Style input characterization", () => {
  it("separates signed fractional lengths, unitless values and keywords", () => {
    expect(parseLength(" -.5rem ")).toEqual({ amount: -0.5, unit: "rem" });
    expect(parseLength("1.5")).toEqual({ amount: 1.5, unit: "" });
    expect(parseLength("auto")).toEqual({ amount: null, unit: "auto" });
    expect(formatLength("12", "px")).toBe("12px");
    expect(() => formatLength("not a number", "px")).toThrow();
  });
  it("round-trips the source gradient/image/overlay composition", () => {
    const layers = {
      mode: "overlay" as const,
      angle: 135,
      start: "#7659e7",
      end: "#172033",
      image: "https://example.com/image.png",
    };
    const css = buildBackgroundLayers(layers);
    expect(css).toBe(
      'linear-gradient(135deg, #7659e7, #172033), url("https://example.com/image.png")',
    );
    expect(backgroundLayers(css ?? "")).toEqual(layers);
    expect(buildBackgroundLayers({ ...layers, mode: "none" })).toBeNull();
  });
  it("rejects unsafe URLs and invalid gradient bounds before dispatch", () => {
    const layers = backgroundLayers("");
    expect(() =>
      buildBackgroundLayers({
        ...layers,
        mode: "image",
        image: "javascript:alert(1)",
      }),
    ).toThrow();
    expect(() =>
      buildBackgroundLayers({ ...layers, mode: "gradient", angle: 361 }),
    ).toThrow();
  });
  it("characterizes transform/filter/shadow defaults and parameter edits", () => {
    expect(buildEffect("transform", effectValues("transform", ""))).toBe(
      "translate(0px, 0px) rotate(0deg) scale(1)",
    );
    expect(buildEffect("filter", effectValues("filter", ""))).toBe(
      "blur(0px) brightness(100%) grayscale(0%)",
    );
    expect(
      buildEffect("backdropFilter", effectValues("backdropFilter", "")),
    ).toBe("blur(0px) brightness(100%)");
    const shadow = effectValues("boxShadow", "2px 3px 4px -1px #123456 inset");
    expect(buildEffect("boxShadow", { ...shadow, y: "8" })).toBe(
      "2px 8px 4px -1px #123456 inset",
    );
    expect(() =>
      buildEffect("filter", { ...effectValues("filter", ""), blur: "-1" }),
    ).toThrow();
    expect(() =>
      buildEffect("transform", {
        ...effectValues("transform", ""),
        scale: "-1",
      }),
    ).toThrow();
  });
});
