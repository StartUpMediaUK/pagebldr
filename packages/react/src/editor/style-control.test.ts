import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  standardStyleCapabilities,
  type PageDocument,
  type ResolvedStyleValue,
} from "@pagebldr/core";
import {
  applicableStyleVariables,
  describeStyleOrigin,
  styleBreakpointFromViewport,
  styleCapabilitiesForSection,
} from "./style-control.js";

describe("Style inspector controls", () => {
  it("maps editor viewports to authored breakpoints", () => {
    expect(styleBreakpointFromViewport("desktop")).toBe("desktop");
    expect(styleBreakpointFromViewport("desktop-fill")).toBe("desktop");
    expect(styleBreakpointFromViewport("tablet")).toBe("tablet");
    expect(styleBreakpointFromViewport("mobile")).toBe("mobile");
  });

  it("keeps presentation capabilities in Style and structural capabilities in Advanced", () => {
    expect(
      styleCapabilitiesForSection(standardStyleCapabilities, "style").map(
        ({ key }) => key,
      ),
    ).toEqual(["typography", "background"]);
    expect(
      styleCapabilitiesForSection(standardStyleCapabilities, "advanced").map(
        ({ key }) => key,
      ),
    ).toEqual([
      "layout",
      "spacing",
      "size",
      "position",
      "border",
      "effects",
      "responsive-visibility",
    ]);
  });

  it("filters Variables by property applicability and describes inherited origins", () => {
    const builder = createPagebldr({ namespace: "style-control-test" });
    const created = builder.documents.create({ id: "page" });
    const document: PageDocument = {
      ...created,
      variables: {
        brand: { id: "brand", name: "Brand", kind: "color", value: "#112233" },
        space: { id: "space", name: "Space", kind: "spacing", value: "16px" },
      },
      variableOrder: ["brand", "space"],
      classes: {
        card: { id: "card", name: "Card", styles: {} },
      },
      classOrder: ["card"],
    };
    expect(applicableStyleVariables(document, ["color"])).toEqual([
      document.variables.brand,
    ]);

    const resolved: ResolvedStyleValue = {
      value: "#112233",
      source: {
        sourceType: "class",
        sourceId: "card",
        breakpoint: "desktop",
        state: "normal",
        inherited: true,
      },
    };
    expect(describeStyleOrigin(document, resolved)).toBe(
      "Class Card · Desktop · Normal · inherited",
    );
  });
});
