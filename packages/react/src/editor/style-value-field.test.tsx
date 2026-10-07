import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StyleValueField,
  styleChoices,
  styleUnits,
} from "./style-value-field.js";

describe("composed inspector presentation", () => {
  for (const property of [
    "fontFamily",
    "fontWeight",
    "display",
    "backgroundImage",
    "fontSize",
    "opacity",
    "transform",
    "filter",
    "backdropFilter",
    "boxShadow",
    "width",
    "textAlign",
    "flexWrap",
  ]) {
    it(`renders ${property} with names, source controls and inheritance without mutation`, () => {
      let commits = 0;
      const html = renderToStaticMarkup(
        <StyleValueField
          property={property}
          label={`Test ${property}`}
          value=""
          resolvedValue=""
          disabled={false}
          onCommit={() => commits++}
        >
          <p>Inherited origin</p>
        </StyleValueField>,
      );
      expect(html).toContain(`Test ${property}`);
      expect(html).toContain("Inherited origin");
      expect(commits).toBe(0);
      if (styleChoices[property]) expect(html).toContain("<select");
      if (styleUnits(property) && property !== "width")
        expect(html).toContain(" unit");
    });
  }
  it("preserves current custom options and disables mutation controls", () => {
    const html = renderToStaticMarkup(
      <StyleValueField
        property="display"
        label="Display"
        value="inline-flex"
        resolvedValue=""
        disabled
        onCommit={() => {
          throw new Error("unexpected edit");
        }}
      />,
    );
    expect(html).toContain("Custom: inline-flex");
    expect(html).toContain('disabled=""');
  });
});
