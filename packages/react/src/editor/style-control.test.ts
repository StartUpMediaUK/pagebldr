import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  standardStyleCapabilities,
  standardElements,
  type PageDocument,
  type ResolvedStyleValue,
} from "@pagebldr/core";
import {
  resetStyleSection,
  applicableStyleVariables,
  describeStyleOrigin,
  styleBreakpointFromViewport,
  styleCapabilitiesForSection,
} from "./style-control.js";

describe("Style inspector controls", () => {
  it("resets a composed section atomically without clearing other styling or panel content", () => {
    const builder = createPagebldr({
      namespace: "tab-style-reset",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const base = builder.documents.create({ id: "page" });
    const definition = builder.elements.get("content-tabs")!;
    const defaults = definition.defaults() as Record<string, unknown>;
    const source: PageDocument = {
      ...base,
      elements: {
        ...base.elements,
        [base.rootId]: { ...base.elements[base.rootId]!, children: ["tabs"] },
        tabs: {
          ...base.elements[base.rootId]!,
          id: "tabs",
          type: "content-tabs",
          children: [],
          props: {
            ...defaults,
            tabFontSize: 26,
            tabColor: "#123456",
            tabActiveBackground: "#334455",
          },
          styles: {
            desktop: {
              normal: { fontFamily: "serif", backgroundColor: "#eeeeee" },
            },
            mobile: { normal: { fontFamily: "sans-serif" } },
          },
        },
      },
    };
    const draft = resetStyleSection(
      source,
      "tabs",
      defaults,
      ["tabFontSize", "tabColor"],
      ["fontFamily"],
      "desktop",
      "normal",
    );
    expect(draft.elements.tabs!.props.tabFontSize).toBe(defaults.tabFontSize);
    expect(draft.elements.tabs!.props.tabColor).toBe("");
    expect(draft.elements.tabs!.props.tabActiveBackground).toBe("#334455");
    expect(draft.elements.tabs!.styles.desktop?.normal).toEqual({
      backgroundColor: "#eeeeee",
    });
    expect(draft.elements.tabs!.styles.mobile).toEqual(
      source.elements.tabs!.styles.mobile,
    );
    expect(source.elements.tabs!.props.tabFontSize).toBe(26);
    const history = builder.editor.history.commit(
      builder.editor.history.create(source),
      {
        type: "apply-subtree",
        elementId: "tabs",
        baseDocument: source,
        document: draft,
      },
    );
    expect(builder.editor.history.undo(history).present).toEqual(source);
    expect(
      resetStyleSection(
        draft,
        "tabs",
        defaults,
        ["tabFontSize", "tabColor"],
        ["fontFamily"],
        "desktop",
        "normal",
      ),
    ).toBe(draft);
  });
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
