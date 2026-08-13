import { describe, expect, it } from "vitest";

import { createPagebldr } from "./config.js";
import type { PageDocument, ResponsiveStyles } from "./document-types.js";
import {
  createFiveHundredElementFixture,
  createShallowFixture,
} from "./fixtures.js";
import { defineStyleCapability } from "./styles.js";

const capability = defineStyleCapability({
  key: "layout",
  label: "Layout",
  properties: ["color", "display", "gap", "padding"],
});
const builder = createPagebldr({
  namespace: "style-test",
  styleCapabilities: [capability],
});

function withStyles(
  input: PageDocument,
  styles: ResponsiveStyles,
  hidden = false,
): PageDocument {
  return {
    ...input,
    elements: {
      ...input.elements,
      [input.rootId]: { ...input.elements[input.rootId]!, styles, hidden },
    },
  };
}

describe("Style engine", () => {
  it("compiles variables, Classes, Elements, states, breakpoints, and hidden Elements deterministically", () => {
    const base = createShallowFixture();
    const document: PageDocument = {
      ...withStyles(
        base,
        {
          desktop: {
            normal: {
              padding: "12px",
              color: { type: "variable", variableId: "brand" },
            },
            hover: { color: "blue" },
          },
          tablet: { normal: { padding: "8px" } },
          mobile: { focusVisible: { display: "block" } },
        },
        true,
      ),
      classes: {
        card: {
          id: "card",
          name: "Card",
          styles: { desktop: { normal: { gap: 4 } } },
        },
      },
      classOrder: ["card"],
      variables: {
        brand: { id: "brand", name: "Brand", kind: "color", value: "#123456" },
      },
      variableOrder: ["brand"],
    };
    const first = builder.styles.compile(document);
    const second = builder.styles.compile(structuredClone(document));

    expect(first).toEqual(second);
    expect(first.css).toBe(
      [
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"]{--pb-style-test-v-brand:#123456}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-class~="card"]{gap:4}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]{display:none!important}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]{color:var(--pb-style-test-v-brand);padding:12px}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]:hover{color:blue}',
        '@media (max-width:1024px){[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]{padding:8px}}',
        '@media (max-width:767px){[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]:focus-visible{display:block}}',
      ].join("\n"),
    );
  });

  it("rejects duplicate capabilities, unregistered properties, and injectable values", () => {
    expect(() =>
      createPagebldr({
        namespace: "duplicate",
        styleCapabilities: [capability, capability],
      }),
    ).toThrowError(/Duplicate capability/u);
    expect(() =>
      builder.styles.compile(
        withStyles(createShallowFixture(), {
          desktop: { normal: { position: "fixed" } },
        }),
      ),
    ).toThrowError(/not registered/u);
    expect(() =>
      builder.styles.compile(
        withStyles(createShallowFixture(), {
          desktop: { normal: { color: "red;}body{display:none" } },
        }),
      ),
    ).toThrowError(/rule delimiters/u);
  });

  it("keeps authored CSS within the 500-Element budget", () => {
    const fixture = createFiveHundredElementFixture();
    const styles = { desktop: { normal: { display: "block" } } } as const;
    const document = {
      ...fixture,
      elements: Object.fromEntries(
        Object.entries(fixture.elements).map(([id, element]) => [
          id,
          { ...element, styles },
        ]),
      ),
    };
    const css = builder.styles.compile(document).css;
    expect(css.length).toBeLessThan(100_000);
  });
});
