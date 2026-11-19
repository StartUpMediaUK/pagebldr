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
  namespace: "accordion-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
function fixture(multiple = false): PageDocument {
  const base = builder.documents.create({ id: "accordion" });
  const element = (
    id: string,
    type: string,
    children: readonly string[] = [],
    props = {},
  ): PageElement => ({
    ...base.elements.root!,
    id,
    type,
    children,
    elementVersion: 1,
    props: {
      ...(builder.elements.get(type)!.defaults() as Record<string, unknown>),
      ...props,
    },
  });
  return {
    ...base,
    elements: {
      root: { ...base.elements.root!, children: ["group", "second"] },
      group: element("group", "content-accordion", ["first", "last"], {
        allowMultiple: multiple,
      }),
      first: element("first", "accordion-panel", ["answer"], {
        question: "First question",
        defaultOpen: true,
      }),
      last: element("last", "accordion-panel", [], {
        question: "Last question",
        defaultOpen: true,
      }),
      answer: element("answer", "heading", [], {
        content: "Structured answer",
      }),
      second: element("second", "content-accordion", ["other"]),
      other: element("other", "accordion-panel", [], {
        question: "Other question",
        defaultOpen: true,
      }),
    },
  };
}
const render = (document: PageDocument, selectedElementId?: string) =>
  renderToString(
    <PagebldrRenderer
      builder={builder}
      document={document}
      mode={selectedElementId ? "edit" : "published"}
      {...(selectedElementId ? { selectedElementId } : {})}
    />,
  );

describe("rich accordion rendering", () => {
  it("renders a scoped canvas without changing the complete valid page Document", () => {
    const document = fixture();
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        rootElementId="first"
        mode="edit"
      />,
    );
    expect(builder.documents.validate(document).valid).toBe(true);
    expect(html).toContain('data-pagebldr-element="first"');
    expect(html).toContain('data-pagebldr-element="answer"');
    expect(html).not.toContain('data-pagebldr-element="second"');
    expect(html).not.toContain('data-pagebldr-element="group"');
  });
  it("renders native, independently grouped disclosures with stable question/answer relationships", () => {
    const html = render(fixture());
    expect(html).toContain(
      'name="pagebldr-accordion-group" open="" data-accordion-panel="first"',
    );
    expect(html).toContain(
      'name="pagebldr-accordion-group" data-accordion-panel="last"',
    );
    expect(html).toContain('name="pagebldr-accordion-second" open=""');
    expect(html).toContain(
      'id="pagebldr-accordion-group-question-first" aria-controls="pagebldr-accordion-group-panel-first"',
    );
    expect(html).toContain(
      'id="pagebldr-accordion-group-panel-first" aria-labelledby="pagebldr-accordion-group-question-first"',
    );
    expect(html).toContain("Structured answer");
    expect(html).not.toContain("aria-expanded="); // Native details owns expanded state.
  });
  it("allows all preferred panels in multiple-open mode and all closed without preferences", () => {
    const multiple = render(fixture(true));
    expect(multiple).not.toContain('name="pagebldr-accordion-group"');
    expect(multiple).toContain('open="" data-accordion-panel="first"');
    expect(multiple).toContain('open="" data-accordion-panel="last"');
    const source = fixture();
    const closed = {
      ...source,
      elements: {
        ...source.elements,
        first: {
          ...source.elements.first!,
          props: { ...source.elements.first!.props, defaultOpen: false },
        },
        last: {
          ...source.elements.last!,
          props: { ...source.elements.last!.props, defaultOpen: false },
        },
      },
    };
    expect(render(closed)).not.toContain(
      'name="pagebldr-accordion-group" open',
    );
  });
  it("reveals selected descendants while editing and omits hidden panels only for visitors", () => {
    const source = fixture();
    const document = {
      ...source,
      elements: {
        ...source.elements,
        first: { ...source.elements.first!, hidden: true },
      },
    };
    const published = render(document);
    expect(published).not.toContain("First question");
    expect(published).toContain('open="" data-accordion-panel="last"');
    expect(render(document, "answer")).toContain(
      'open="" data-accordion-panel="first"',
    );
    expect(render(source, "last")).toContain(
      'open="" data-accordion-panel="last"',
    );
    expect(render(source, "last")).not.toContain(
      'open="" data-accordion-panel="first"',
    );
  });
});
