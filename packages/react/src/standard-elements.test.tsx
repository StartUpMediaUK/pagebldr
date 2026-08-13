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
  const elements: Record<string, PageElement> = {
    root: {
      ...base.elements.root!,
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
});
