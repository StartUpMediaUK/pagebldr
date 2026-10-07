import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import { EditorProvider } from "./context.js";
import { StyleControls } from "./style-control.js";

describe("inspector capability boundaries", () => {
  it("places size-only Width in Layout without granting other Layout fields", () => {
    const builder = createPagebldr({
      namespace: "size-only",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const document = builder.documents.create({ id: "page" });
    const element = {
      ...document.elements[document.rootId]!,
      type: "spacer",
      props: {},
    };
    const html = renderToStaticMarkup(
      <EditorProvider
        builder={builder}
        document={document}
        mode="edit"
        onChange={() => undefined}
        applicationDestinations={[]}
      >
        <StyleControls element={element} section="advanced" />
      </EditorProvider>,
    );
    expect(html).toContain("Reset Layout section");
    expect(html.indexOf("Full width")).toBeLessThan(
      html.indexOf("Reset Size section"),
    );
    expect(html).not.toContain("Flex (row or column)");
  });

  it("renders only registered spacing sides", () => {
    const builder = createPagebldr({
      namespace: "partial-spacing",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities.map((capability) =>
        capability.key === "spacing"
          ? { ...capability, properties: ["paddingTop"] }
          : capability,
      ),
    });
    const document = builder.documents.create({ id: "page" });
    const html = renderToStaticMarkup(
      <EditorProvider
        builder={builder}
        document={document}
        mode="edit"
        onChange={() => undefined}
        applicationDestinations={[]}
      >
        <StyleControls
          element={document.elements[document.rootId]!}
          section="advanced"
        />
      </EditorProvider>,
    );
    expect(html).toContain("Padding Top");
    expect(html).not.toContain("Padding Right");
    expect(html).not.toContain("Margin (outside space)");
  });
});
