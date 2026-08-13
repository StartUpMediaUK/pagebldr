import { createPagebldr, type PageDocument } from "@pagebldr/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PagebldrEditor, PagebldrRenderer } from "./index.js";

const builder = createPagebldr({ namespace: "test-app" });
const document: PageDocument = {
  format: "pagebldr",
  schemaVersion: 1,
  id: "page-1",
  title: "Page",
};

describe("React tracer modules", () => {
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
