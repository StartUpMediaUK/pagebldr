import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ColorField } from "./color-field.js";

describe("colour Control SSR presentation", () => {
  it("renders a labelled swatch and text field without changing the source value", () => {
    let commits = 0;
    const html = renderToStaticMarkup(
      <ColorField
        value="#b77255"
        label="Example colour"
        disabled={false}
        onCommit={() => {
          commits++;
        }}
      />,
    );
    expect(html).toContain('aria-label="Choose example colour colour"');
    expect(html).toContain('value="#b77255"');
    expect(html).toContain('data-slot="input-group-control"');
    expect(html).toContain("background-color:#B77255FF");
    expect(commits).toBe(0);
  });
  it("disables both inputs when a Host or locked Element forbids edits", () => {
    const html = renderToStaticMarkup(
      <ColorField
        value="#123456"
        label="Example"
        disabled
        onCommit={() => {
          throw new Error("unexpected mutation");
        }}
      />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
