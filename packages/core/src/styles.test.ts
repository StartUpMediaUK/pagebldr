import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { createPagebldr } from "./config.js";
import type { PageDocument, ResponsiveStyles } from "./document-types.js";
import {
  createFiveHundredElementFixture,
  createShallowFixture,
} from "./fixtures.js";
import {
  defineStyleCapability,
  styleVariableKindsForProperty,
} from "./styles.js";
import {
  standardElements,
  standardStyleCapabilities,
} from "./standard-elements.js";

const capability = defineStyleCapability({
  key: "layout",
  label: "Layout",
  properties: ["backgroundImage", "color", "display", "gap", "padding"],
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
  it("exposes the Variable kinds applicable to each authored property", () => {
    expect(styleVariableKindsForProperty("color")).toEqual(["color"]);
    expect(styleVariableKindsForProperty("width")).toEqual(["contentWidth"]);
    expect(styleVariableKindsForProperty("marginTop")).toEqual(["spacing"]);
    expect(styleVariableKindsForProperty("transform")).toEqual([]);
    expect(builder.styles.variableKindsForProperty("gap")).toEqual(["spacing"]);
  });

  it("ships the nine Quizr capability groups and complete safe property grammar", () => {
    expect(standardStyleCapabilities.map(({ key }) => key)).toEqual([
      "layout",
      "spacing",
      "size",
      "position",
      "typography",
      "background",
      "border",
      "effects",
      "responsive-visibility",
    ]);
    expect(
      standardStyleCapabilities.flatMap(({ properties }) => properties),
    ).toHaveLength(92);
    expect(
      new Set(
        standardStyleCapabilities.flatMap(({ properties }) => properties),
      ),
    ).toHaveLength(91);
  });

  it("resolves breakpoint, state, ordered Class, and local origins", () => {
    const base = createShallowFixture();
    const document: PageDocument = {
      ...withStyles(base, {
        desktop: { normal: { color: "local" } },
        tablet: { hover: { padding: "8px" } },
      }),
      classes: {
        base: {
          id: "base",
          name: "Base",
          styles: { desktop: { normal: { color: "red", padding: "12px" } } },
        },
      },
      classOrder: ["base"],
      elements: {
        ...withStyles(base, {
          desktop: { normal: { color: "local" } },
          tablet: { hover: { padding: "8px" } },
        }).elements,
        root: {
          ...withStyles(base, {
            desktop: { normal: { color: "local" } },
            tablet: { hover: { padding: "8px" } },
          }).elements.root!,
          classIds: ["base"],
        },
      },
    };

    expect(builder.styles.resolve(document, "root", "tablet", "hover")).toEqual(
      {
        color: {
          value: "local",
          source: {
            sourceType: "local",
            sourceId: "root",
            breakpoint: "desktop",
            state: "normal",
            inherited: true,
          },
        },
        padding: {
          value: "8px",
          source: {
            sourceType: "local",
            sourceId: "root",
            breakpoint: "tablet",
            state: "hover",
            inherited: false,
          },
        },
      },
    );
  });

  it("validates and compiles the immutable responsive parity fixture", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "../../../fixtures/parity/responsive-states.document.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    const reference = createPagebldr({
      namespace: "reference-fixture",
      elements: standardElements,
      styleCapabilities: standardStyleCapabilities,
    });
    const result = reference.documents.validate(fixture);
    expect(result.valid).toBe(true);
    if (!result.valid) throw result.error;

    const compiled = reference.styles.compile(result.document);
    expect(compiled.css).toContain("font-size:56px");
    expect(compiled.css).toContain('data-pagebldr-force-state="hover"');
    expect(compiled.css).toContain("@media (max-width:767px)");
    expect(
      reference.styles.resolve(
        result.document,
        "responsive-heading",
        "tablet",
        "hover",
      ).fontSize,
    ).toMatchObject({
      value: "44px",
      source: { breakpoint: "tablet", state: "normal", inherited: false },
    });
  });

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
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-class~="card"][data-pagebldr-class~="card"]{gap:4}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]{display:none!important}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"][data-pagebldr-element="root"]{color:var(--pb-style-test-v-brand);padding:12px}',
        '[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]:hover,[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"][data-pagebldr-force-state="hover"]{color:blue}',
        '@media (max-width:1024px){[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"][data-pagebldr-element="root"]{padding:8px}}',
        '@media (max-width:767px){[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"]:focus-visible,[data-pagebldr="style-test"][data-pagebldr-document="fixture-page"] [data-pagebldr-element="root"][data-pagebldr-force-state="focusVisible"]{display:block}}',
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
    ).toThrowError(/unsafe CSS syntax/u);
    for (const value of [
      "url(javascript:alert(1))",
      "expression(alert(1))",
      "/* hidden */ red",
      "@import url(https://example.com/style.css)",
      "url(https://example.com/image.png)",
    ]) {
      expect(() =>
        builder.styles.compile(
          withStyles(createShallowFixture(), {
            desktop: { normal: { color: value } },
          }),
        ),
      ).toThrowError(/unsafe CSS syntax/u);
    }
    expect(
      builder.styles.compile(
        withStyles(createShallowFixture(), {
          desktop: {
            normal: {
              backgroundImage: "url(https://example.com/image.png)",
            },
          },
        }),
      ).css,
    ).toContain("background-image:url(https://example.com/image.png)");
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
