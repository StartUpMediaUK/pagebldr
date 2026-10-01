import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type PageElement,
} from "@pagebldr/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PagebldrRenderer } from "./index.js";
import allElementsFixture from "../../../fixtures/parity/all-elements.document.json";
import projectEnquiryFixture from "../../../fixtures/parity/project-enquiry.document.json";

const builder = createPagebldr({
  namespace: "standard-library",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

function standardDocument(): PageDocument {
  const base = builder.documents.create({ id: "standard" });
  const definitions = standardElements.filter(
    ({ type }) => type !== "container",
  );
  const container = standardElements.find(({ type }) => type === "container")!;
  const elements: Record<string, PageElement> = {
    root: {
      ...base.elements.root!,
      elementVersion: container.version,
      props: container.defaults() as Readonly<Record<string, unknown>>,
      children: definitions.map(({ type }) => type),
    },
  };
  for (const definition of definitions)
    elements[definition.type] = {
      id: definition.type,
      type: definition.type,
      elementVersion: definition.version,
      name: definition.label,
      props: definition.defaults() as Readonly<Record<string, unknown>>,
      children: [],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
  return { ...base, elements };
}

describe("standard Element renderer", () => {
  it("renders every standard Element through its definition during SSR", () => {
    const document = standardDocument();
    expect(builder.documents.validate(document)).toMatchObject({ valid: true });
    const html = renderToString(
      <PagebldrRenderer builder={builder} document={document} />,
    );
    for (const definition of standardElements)
      expect(html).toContain(
        `data-pagebldr-element="${definition.type === "container" ? "root" : definition.type}"`,
      );
    expect(html).toContain("<h2");
    expect(html).toContain("<nav");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-pagebldr-widget="menu"');
    expect(html).toContain('data-pagebldr-widget="tabs"');
    expect(html).toContain('data-pagebldr-widget="countdown"');
    expect(html).not.toContain("next/");
  });

  it("shows unknown Elements only in edit mode", () => {
    const document = standardDocument();
    const unknown = {
      ...document,
      elements: {
        ...document.elements,
        heading: { ...document.elements.heading!, type: "missing-widget" },
      },
    };
    expect(
      renderToString(
        <PagebldrRenderer builder={builder} document={unknown} mode="edit" />,
      ),
    ).toContain("Unknown Element: missing-widget");
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={unknown}
          mode="published"
        />,
      ),
    ).not.toContain("Unknown Element");
  });

  it("can force the selected Element's authored interaction state in edit mode", () => {
    const document = standardDocument();
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        mode="edit"
        forcedStyleState={{ elementId: "heading", state: "hover" }}
      />,
    );
    expect(html).toContain(
      'data-pagebldr-element="heading" id="pagebldr-heading" data-pagebldr-force-state="hover"',
    );
    expect(html).not.toContain(
      'data-pagebldr-element="button" id="pagebldr-button" data-pagebldr-force-state',
    );
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={document}
          mode="published"
          forcedStyleState={{ elementId: "heading", state: "hover" }}
        />,
      ),
    ).not.toContain("data-pagebldr-force-state");
  });

  it("keeps hidden Elements discoverable only while editing", () => {
    const document = standardDocument();
    const hidden = {
      ...document,
      elements: {
        ...document.elements,
        heading: { ...document.elements.heading!, hidden: true },
      },
    };
    const editingHtml = renderToString(
      <PagebldrRenderer builder={builder} document={hidden} mode="edit" />,
    );
    expect(editingHtml).toContain('data-pagebldr-hidden="true"');
    expect(editingHtml).toContain("display:revert!important");
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={hidden}
          mode="published"
        />,
      ),
    ).not.toContain('id="pagebldr-heading"');
  });

  it("validates and SSR-renders the complete parity fixtures", () => {
    for (const input of [allElementsFixture, projectEnquiryFixture]) {
      const document = input as unknown as PageDocument;
      const validation = builder.documents.validate(document);
      if (!validation.valid) throw validation.error;
      const html = renderToString(
        <PagebldrRenderer builder={builder} document={document} />,
      );
      expect(html).toContain(`data-pagebldr-element="${document.rootId}"`);
      expect(html).not.toContain("Unknown Element");
    }
  });
});
