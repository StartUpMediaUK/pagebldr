import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  createFiveHundredElementFixture,
  createInvalidFixture,
  createShallowFixture,
} from "./fixtures.js";
import { createPagebldr, defineElement, PagebldrError } from "./index.js";
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
      elements: { root: { ...element("root"), type: "unknown" } },
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
      builder.documents.migrate({ ...current, schemaVersion: 2 }),
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
