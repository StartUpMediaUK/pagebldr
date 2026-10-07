import { describe, expect, it } from "vitest";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type ResponsiveStyles,
} from "@pagebldr/core";
import { replaceStyleProperties } from "./style-layer.js";

describe("inspector layer edits", () => {
  it("changes linked sides atomically and preserves wider states and breakpoints", () => {
    const builder = createPagebldr({
      namespace: "linked-spacing",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const initial = builder.documents.create({ id: "page" });
    const styles: ResponsiveStyles = {
      desktop: { normal: { paddingTop: "12px", color: "#123456" } },
      tablet: { hover: { gap: "4px" } },
    };
    const next = replaceStyleProperties(
      styles,
      "tablet",
      "hover",
      ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
      "16px",
    );
    expect(next.desktop).toEqual(styles.desktop);
    expect(next.tablet?.hover).toEqual({
      gap: "4px",
      paddingTop: "16px",
      paddingRight: "16px",
      paddingBottom: "16px",
      paddingLeft: "16px",
    });
    const history = builder.editor.history.create(initial);
    const applied = builder.editor.history.commit(history, {
      type: "replace-styles",
      elementId: initial.rootId,
      styles: next,
    });
    expect(builder.editor.history.undo(applied).present).toEqual(initial);
  });
  it("resets only named properties and removes empty layers without mutating its input", () => {
    const styles: ResponsiveStyles = {
      desktop: { normal: { color: "#123456" } },
      tablet: { hover: { gap: "4px" } },
    };
    const next = replaceStyleProperties(
      styles,
      "tablet",
      "hover",
      ["gap"],
      null,
    );
    expect(next).toEqual({ desktop: styles.desktop });
    expect(styles.tablet?.hover?.gap).toBe("4px");
  });
});
