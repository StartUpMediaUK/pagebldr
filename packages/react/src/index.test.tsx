import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "@pagebldr/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PagebldrEditor, PagebldrRenderer } from "./index.js";
import allElementsFixture from "../../../fixtures/parity/all-elements.document.json";

const builder = createPagebldr({ namespace: "test-app" });
const document = builder.documents.create({ id: "page-1", title: "Page" });

describe("React tracer modules", () => {
  it("renders Structure leaf spacing without unnamed interactive placeholders", () => {
    const library = createPagebldr({
      namespace: "accessible-editor",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const output = renderToString(
      <PagebldrEditor
        builder={library}
        document={allElementsFixture as unknown as PageDocument}
        onChange={() => {}}
      />,
    );
    expect(output).toContain('aria-label="Page structure"');
    expect(output).toContain('aria-label="Collapse All standard Elements"');
    expect(output).toContain(
      '<span aria-hidden="true" class="size-6 shrink-0">',
    );
    expect(output).not.toMatch(
      /<button[^>]*data-slot="button"[^>]*disabled=""[^>]*tabindex="-1"[^>]*><\/button>/,
    );
  });

  it("renders on the server without browser globals", () => {
    expect(
      renderToString(
        <PagebldrRenderer builder={builder} document={document} />,
      ),
    ).toContain('data-pagebldr-renderer="test-app"');
  });

  it("accepts a controlled document interface", () => {
    const onChange = vi.fn();
    const output = renderToString(
      <PagebldrEditor
        builder={builder}
        document={document}
        onChange={onChange}
      />,
    );

    expect(output).toContain('data-pagebldr-mode="edit"');
    expect(onChange).not.toHaveBeenCalled();
  });
});
