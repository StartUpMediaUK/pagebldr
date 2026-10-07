import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import { UnitField } from "./style-value-field.js";

describe("controlled inspector choices", () => {
  it("composes numeric Variable amounts with their source unit choices", () => {
    const html = renderToStaticMarkup(
      <UnitField
        property="spacing"
        label="Space value"
        value="16px"
        resolvedValue="16px"
        units={["px", "rem", "%"]}
        disabled={false}
        onCommit={() => undefined}
      />,
    );
    expect(html).toContain('type="number"');
    expect(html).toContain('value="16"');
    expect(html).toContain('aria-label="Space value unit"');
    expect(html).toContain('data-value="px"');
  });
  it("renders the selected label without a browser or a change command", () => {
    let changes = 0;
    const html = renderToStaticMarkup(
      <InspectorSelect
        value="desktop"
        aria-label="Authored breakpoint"
        onChange={() => changes++}
      >
        <InspectorSelectOption value="desktop">Desktop</InspectorSelectOption>
        <InspectorSelectOption value="tablet">Tablet</InspectorSelectOption>
      </InspectorSelect>,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-value="desktop"');
    expect(html).toContain("Desktop");
    expect(changes).toBe(0);
  });

  it("preserves empty inherited choices and readonly state", () => {
    const html = renderToStaticMarkup(
      <InspectorSelect value="" disabled aria-label="Font family">
        <InspectorSelectOption value="">Default</InspectorSelectOption>
      </InspectorSelect>,
    );
    expect(html).toContain("Default");
    expect(html).toContain('data-value=""');
    expect(html).toContain('disabled=""');
  });
});
