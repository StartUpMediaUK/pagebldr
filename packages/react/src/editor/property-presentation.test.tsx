import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { standardElements, type ElementControl } from "@pagebldr/core";
import {
  propertyControlLabel,
  propertyOptionIcon,
} from "./property-presentation.js";
import { SliderField } from "./slider-field.js";

describe("definition-owned inspector presentation", () => {
  it("matches the pinned Menu's conditional alignment label without an Element switch", () => {
    const menu = standardElements.find(({ type }) => type === "menu")!;
    const control = menu.styleControls!.find(
      ({ key }) => key === "itemAlignment",
    )!;
    expect(
      propertyControlLabel(control, {
        collapseAt: "tablet",
        presentation: "fullscreen",
      }),
    ).toBe("Horizontal alignment");
    expect(
      propertyControlLabel(control, {
        collapseAt: "never",
        presentation: "fullscreen",
      }),
    ).toBe("Menu items align");
    expect(
      propertyControlLabel(control, {
        collapseAt: "tablet",
        presentation: "dropdown",
      }),
    ).toBe("Menu items align");
  });

  it("supports serializable third-party labels and semantic presentations", () => {
    const control: ElementControl<Record<string, unknown>> = {
      kind: "select",
      key: "alignment",
      label: "Alignment",
      labelWhen: [
        {
          label: "Wide alignment",
          conditions: [{ key: "wide", equals: true }],
        },
      ],
      presentation: "horizontal-alignment",
      options: [
        { label: "Start", value: "start" },
        { label: "Custom", value: "custom" },
      ],
    };
    const roundTrip = JSON.parse(JSON.stringify(control)) as typeof control;
    expect(propertyControlLabel(roundTrip, { wide: true })).toBe(
      "Wide alignment",
    );
    expect(propertyControlLabel(roundTrip, {})).toBe("Alignment");
    expect(propertyOptionIcon(roundTrip.presentation, "start")).not.toBeNull();
    expect(propertyOptionIcon(roundTrip.presentation, "custom")).toBeNull();
    for (const value of ["desktop", "tablet", "mobile", "never"])
      expect(propertyOptionIcon("viewport", value)).not.toBeNull();
    for (const value of ["start", "center", "end"])
      expect(propertyOptionIcon("vertical-alignment", value)).not.toBeNull();
  });

  it("renders a named bounded slider with units and a disabled keyboard path", () => {
    const html = renderToStaticMarkup(
      <SliderField
        label="Example spacing"
        value={24}
        min={0}
        max={96}
        unit="px"
        disabled={false}
        onCommit={() => {}}
      />,
    );
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="96"');
    expect(html).toContain('aria-valuetext="24px"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain('tabindex="0"');
    const disabled = renderToStaticMarkup(
      <SliderField
        label="Example spacing"
        value={24}
        min={0}
        max={96}
        disabled
        onCommit={() => {}}
      />,
    );
    expect(disabled).not.toContain('tabindex="0"');
  });
});
