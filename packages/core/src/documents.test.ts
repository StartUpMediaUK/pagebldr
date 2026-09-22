import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  createFiveHundredElementFixture,
  createInvalidFixture,
  createShallowFixture,
} from "./fixtures.js";
import {
  createPagebldr,
  defineElement,
  DOCUMENT_SCHEMA_VERSION,
  PagebldrError,
  standardStyleCapabilities,
} from "./index.js";
import type { PageDocument, PageElement } from "./index.js";

const container = defineElement({
  type: "container",
  version: 1,
  label: "Container",
  props: z.object({}).passthrough(),
  defaults: () => ({}),
});

const builder = createPagebldr({
  namespace: "document-tests",
  elements: [container],
});

describe("builder.documents", () => {
  it("creates the complete schema-v2 page settings contract", () => {
    const document = builder.documents.create({ id: "home", title: "Home" });

    expect(DOCUMENT_SCHEMA_VERSION).toBe(2);
    expect(document).toMatchObject({
      schemaVersion: 2,
      settings: {
        contentWidth: 1_200,
        showDefaultHeader: true,
        breakpoints: { tabletMax: 1_024, mobileMax: 767 },
        seo: {
          title: "Home",
          description: "",
          socialTitle: "",
          socialDescription: "",
          socialImage: null,
          noIndex: false,
        },
      },
    });
  });

  it("migrates schema-v1 metadata to schema-v2 SEO without mutating input", () => {
    const current = builder.documents.create({ id: "home", title: "Home" });
    const legacy = {
      ...current,
      schemaVersion: 1,
      settings: {
        contentWidth: current.settings.contentWidth,
        breakpoints: current.settings.breakpoints,
        metadata: {
          title: "Search title",
          description: "Search description",
          noIndex: true,
        },
      },
    };
    const snapshot = structuredClone(legacy);

    expect(builder.documents.migrate(legacy)).toMatchObject({
      schemaVersion: 2,
      settings: {
        showDefaultHeader: true,
        seo: {
          title: "Search title",
          description: "Search description",
          socialTitle: "",
          socialDescription: "",
          socialImage: null,
          noIndex: true,
        },
      },
    });
    expect(legacy).toEqual(snapshot);
  });

  it("enforces SEO bounds and unique anchor IDs", () => {
    const current = builder.documents.create({ id: "home", title: "Home" });
    const invalidSeo = {
      ...current,
      settings: {
        ...current.settings,
        seo: { ...current.settings.seo, title: "x".repeat(71) },
      },
    };
    expect(builder.documents.validate(invalidSeo)).toMatchObject({
      valid: false,
      error: { code: "INVALID_DOCUMENT" },
    });

    const duplicateAnchors = withElements(current, {
      root: { ...element("root", ["child"]), props: { anchorId: "intro" } },
      child: { ...element("child"), props: { anchorId: "intro" } },
    });
    expect(builder.documents.validate(duplicateAnchors)).toMatchObject({
      valid: false,
      error: { code: "INVALID_DOCUMENT" },
    });
  });

  it("validates typed destinations discovered by Element definitions", () => {
    const link = defineElement({
      type: "link",
      version: 1,
      label: "Link",
      props: z.object({ destination: z.unknown() }),
      defaults: () => ({ destination: null }),
      childPolicy: { kind: "none" },
      destinations: (props) => [props.destination],
    });
    const destinationBuilder = createPagebldr({
      namespace: "destination-tests",
      elements: [container, link],
    });
    const current = destinationBuilder.documents.create({ id: "links" });
    const valid = withElements(current, {
      root: element("root", ["target", "link"]),
      target: { ...element("target"), props: { anchorId: "target" } },
      link: {
        ...element("link"),
        type: "link",
        props: { destination: { type: "anchor", elementId: "target" } },
      },
    });
    expect(destinationBuilder.documents.validate(valid).valid).toBe(true);

    const broken = {
      ...valid,
      elements: {
        ...valid.elements,
        link: {
          ...valid.elements.link!,
          props: {
            destination: { type: "anchor", elementId: "missing" },
          },
        },
      },
    };
    expect(destinationBuilder.documents.validate(broken)).toMatchObject({
      valid: false,
      error: { code: "BROKEN_REFERENCE" },
    });

    const unsafe = {
      ...valid,
      elements: {
        ...valid.elements,
        link: {
          ...valid.elements.link!,
          props: {
            destination: {
              type: "external",
              url: "javascript:alert(1)",
              newTab: false,
            },
          },
        },
      },
    };
    expect(destinationBuilder.documents.validate(unsafe)).toMatchObject({
      valid: false,
      error: { code: "INVALID_ELEMENT" },
    });
  });

  it("enforces root, style capability, property, and Variable-kind invariants", () => {
    const styledContainer = defineElement({
      ...container,
      styles: ["typography"],
    });
    const styledBuilder = createPagebldr({
      namespace: "style-validation-tests",
      elements: [styledContainer],
      styleCapabilities: standardStyleCapabilities,
    });
    const current = styledBuilder.documents.create({ id: "styled" });

    for (const styles of [
      { desktop: { normal: { padding: "12px" } } },
      { desktop: { normal: { madeUpProperty: "value" } } },
    ] as const) {
      expect(
        styledBuilder.documents.validate({
          ...current,
          elements: { root: { ...current.elements.root!, styles } },
        }),
      ).toMatchObject({ valid: false, error: { code: "INVALID_ELEMENT" } });
    }

    const incompatibleVariable = {
      ...current,
      variables: {
        space: { id: "space", name: "Space", kind: "spacing", value: "12px" },
      },
      variableOrder: ["space"],
      elements: {
        root: {
          ...current.elements.root!,
          styles: {
            desktop: {
              normal: {
                color: { type: "variable", variableId: "space" },
              },
            },
          },
        },
      },
    };
    expect(
      styledBuilder.documents.validate(incompatibleVariable),
    ).toMatchObject({
      valid: false,
      error: { code: "INVALID_ELEMENT" },
    });

    const nonContainerRoot = {
      ...current,
      elements: { root: { ...current.elements.root!, type: "text" } },
    };
    expect(styledBuilder.documents.validate(nonContainerRoot)).toMatchObject({
      valid: false,
      error: { code: "INVALID_DOCUMENT" },
    });
  });

  it("creates, validates, clones, and canonically serializes Documents", () => {
    const document = builder.documents.create({ id: "home", title: "Home" });
    expect(builder.documents.validate(document).valid).toBe(true);
    const serialized = builder.documents.serialize(document);
    expect(builder.documents.deserialize(serialized)).toEqual(document);
    expect(
      builder.documents.serialize(builder.documents.deserialize(serialized)),
    ).toBe(serialized);
    const clone = builder.documents.clone(document);
    expect(clone).toEqual(document);
    expect(clone).not.toBe(document);
  });

  it("builds parent, order, depth, descendant, and preorder indexes", () => {
    const document = withElements(createShallowFixture(), {
      root: element("root", ["child"]),
      child: element("child"),
    });
    const index = builder.documents.index(document);
    expect(index.parentById.get("child")).toBe("root");
    expect(index.indexById.get("child")).toBe(0);
    expect(index.depthById.get("child")).toBe(1);
    expect(index.descendantsById.get("root")).toEqual(new Set(["child"]));
    expect(index.preorder).toEqual(["root", "child"]);
  });

  it.each([
    ["missing root", createInvalidFixture(), "BROKEN_REFERENCE"],
    [
      "cycle",
      withElements(createShallowFixture(), {
        root: element("root", ["child"]),
        child: element("child", ["root"]),
      }),
      "CIRCULAR_NESTING",
    ],
    [
      "multiple parents",
      withElements(createShallowFixture(), {
        root: element("root", ["left", "right"]),
        left: element("left", ["shared"]),
        right: element("right", ["shared"]),
        shared: element("shared"),
      }),
      "INVALID_PARENT",
    ],
    [
      "orphan",
      withElements(createShallowFixture(), {
        root: element("root"),
        orphan: element("orphan"),
      }),
      "INVALID_PARENT",
    ],
  ])("rejects %s", (_label, document, code) => {
    expect(() =>
      builder.documents.index(document as PageDocument),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it("rejects broken Class references and duplicate order entries", () => {
    const missingClass = {
      ...createShallowFixture(),
      elements: { root: { ...element("root"), classIds: ["missing"] } },
    };
    expect(builder.documents.validate(missingClass)).toMatchObject({
      valid: false,
      error: { code: "BROKEN_REFERENCE" },
    });
    const duplicateOrder = {
      ...createShallowFixture(),
      classes: { one: { id: "one", name: "One", styles: {} } },
      classOrder: ["one", "one"],
    };
    expect(builder.documents.validate(duplicateOrder)).toMatchObject({
      valid: false,
      error: { code: "INVALID_DOCUMENT" },
    });
  });

  it("rejects unknown Elements and Documents beyond structural limits", () => {
    const unknown = {
      ...createShallowFixture(),
      elements: {
        root: element("root", ["unknown"]),
        unknown: { ...element("unknown"), type: "unknown" },
      },
    };
    expect(builder.documents.validate(unknown)).toMatchObject({
      valid: false,
      error: { code: "INVALID_ELEMENT" },
    });

    const elements = Object.fromEntries(
      Array.from({ length: 5_001 }, (_, index) => {
        const id = index === 0 ? "root" : `wide-${index}`;
        return [id, element(id)] as const;
      }),
    );
    elements.root = element("root", Object.keys(elements).slice(1));
    expect(
      builder.documents.validate({ ...createShallowFixture(), elements }),
    ).toMatchObject({
      valid: false,
      error: { code: "INVALID_DOCUMENT" },
    });
  });

  it("indexes the immutable 500-Element fixture", () => {
    const fixture = createFiveHundredElementFixture();
    expect(Object.isFrozen(fixture)).toBe(true);
    expect(builder.documents.index(fixture).preorder).toHaveLength(500);
  });

  it("rejects future schemas and missing Document migrations", () => {
    const current = createShallowFixture();
    expect(() =>
      builder.documents.migrate({ ...current, schemaVersion: 3 }),
    ).toThrowError(expect.objectContaining({ code: "FUTURE_SCHEMA" }));
    expect(() =>
      builder.documents.migrate({ ...current, schemaVersion: 0 }),
    ).toThrowError(expect.objectContaining({ code: "MIGRATION_MISSING" }));
  });

  it("rejects future Element versions and missing Element migration steps", () => {
    const current = createShallowFixture();
    expect(() =>
      builder.documents.migrate({
        ...current,
        elements: { root: { ...current.elements.root!, elementVersion: 2 } },
      }),
    ).toThrowError(expect.objectContaining({ code: "FUTURE_SCHEMA" }));

    const versionTwoWithoutMigration = createPagebldr({
      namespace: "missing-element-migration",
      elements: [
        defineElement({
          type: "container",
          version: 2,
          label: "Container",
          props: z.object({}).passthrough(),
          defaults: () => ({}),
        }),
      ],
    });
    expect(() =>
      versionTwoWithoutMigration.documents.migrate(current),
    ).toThrowError(expect.objectContaining({ code: "MIGRATION_MISSING" }));
  });

  it("runs deterministic, input-immutable Document and Element migration chains", () => {
    const versionTwo = defineElement({
      type: "container",
      version: 2,
      label: "Container",
      props: z.record(z.unknown()),
      defaults: () => ({}),
      migrate: (_props, fromVersion) => ({ migratedFrom: fromVersion }),
    });
    const migrating = createPagebldr({
      namespace: "migration-tests",
      elements: [versionTwo],
      migrations: [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate: (input) => ({ ...input, format: "pagebldr" }),
        },
      ],
    });
    const current = createShallowFixture();
    const input = {
      ...current,
      schemaVersion: 0,
      elements: { root: { ...current.elements.root!, elementVersion: 1 } },
    };
    const snapshot = structuredClone(input);
    const first = migrating.documents.migrate(input);
    const second = migrating.documents.migrate(input);
    expect(first).toEqual(second);
    expect(input).toEqual(snapshot);
    expect(first.elements.root).toMatchObject({
      elementVersion: 2,
      props: { migratedFrom: 1 },
    });
    expect(migrating.documents.migrate(first)).toEqual(first);
  });

  it("rejects invalid IDs at the schema seam", () => {
    expect(() =>
      builder.documents.parse({ ...createShallowFixture(), id: "bad id" }),
    ).toThrow(PagebldrError);
  });
});

function element(id: string, children: readonly string[] = []): PageElement {
  return {
    id,
    type: "container",
    elementVersion: 1,
    name: id,
    props: {},
    children,
    classIds: [],
    styles: {},
    locked: false,
    hidden: false,
  };
}

function withElements(
  document: PageDocument,
  elements: Readonly<Record<string, PageElement>>,
): PageDocument {
  return { ...document, elements };
}
