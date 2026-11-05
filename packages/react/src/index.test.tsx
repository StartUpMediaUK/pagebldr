import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "@pagebldr/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PagebldrEditor,
  PagebldrRenderer,
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
  usePagebldrEditor,
} from "./index.js";
import allElementsFixture from "../../../fixtures/parity/all-elements.document.json";

const builder = createPagebldr({ namespace: "test-app" });
const document = builder.documents.create({ id: "page-1", title: "Page" });

describe("React tracer modules", () => {
  it("renders Host Contributions inside the controlled editor context", () => {
    const contribution = defineEditorContribution({
      id: "host.document-status",
      kind: "statusItem",
      label: "Host document status",
      render: ({ context }) => {
        const editor = usePagebldrEditor();
        expect(editor.document).toBe(context.document);
        expect(context.dispatch).toBeTypeOf("function");
        expect(context).not.toHaveProperty("store");
        expect(context).not.toHaveProperty("canvasProtocol");
        return <span>Host document: {context.document.title}</span>;
      },
    });
    const preset = defineEditorPreset({
      id: "host.standard",
      label: "Host standard",
      placements: standardEditorPreset.placements.map((placement) => ({
        ...placement,
        contributionIds:
          placement.slot === "status"
            ? [...placement.contributionIds, contribution.id]
            : placement.contributionIds,
      })),
    });
    const output = renderToString(
      <PagebldrEditor
        builder={builder}
        document={document}
        onChange={() => {}}
        contributions={[contribution]}
        preset={preset}
      />,
    );
    expect(output).toContain("Host document: ");
    expect(output).toContain('data-pagebldr-mode="edit"');
    expect(output).toContain('aria-label="Page structure"');
  });

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
