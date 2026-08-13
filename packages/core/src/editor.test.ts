import { z } from "zod";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  createPagebldr,
  createSequentialIdFactory,
  defineElement,
} from "./index.js";
import { createFiveHundredElementFixture } from "./fixtures.js";
import type {
  EditorCommand,
  PageDocument,
  PageElement,
  PagebldrClipboard,
} from "./index.js";

const definition = defineElement({
  type: "container",
  version: 1,
  label: "Container",
  props: z.record(z.unknown()),
  defaults: () => ({}),
});
const builder = createPagebldr({
  namespace: "editor-tests",
  elements: [definition],
});

describe("builder.editor", () => {
  it("inserts, moves, duplicates, and removes subtrees through dispatch", () => {
    let document = base();
    document = dispatch(document, {
      type: "insert",
      parentId: "root",
      index: 0,
      clipboard: clipboard("one"),
    });
    document = dispatch(document, {
      type: "insert",
      parentId: "root",
      index: 1,
      clipboard: clipboard("two"),
    });
    document = dispatch(document, {
      type: "move",
      elementId: "two",
      parentId: "one",
      index: 0,
    });
    document = dispatch(document, {
      type: "duplicate",
      elementId: "one",
      idFactory: createSequentialIdFactory("copy"),
    });
    expect(Object.keys(document.elements)).toHaveLength(5);
    const copyId = document.elements.root!.children[1]!;
    document = dispatch(document, { type: "remove", elementId: copyId });
    expect(Object.keys(document.elements)).toHaveLength(3);
    expect(builder.documents.validate(document).valid).toBe(true);
  });

  it("edits properties, styles, lock, visibility, page metadata, and settings", () => {
    let document = dispatch(base(), {
      type: "insert",
      parentId: "root",
      index: 0,
      clipboard: clipboard("item"),
    });
    document = builder.editor.dispatchMany(document, [
      { type: "rename", elementId: "item", name: "Renamed" },
      { type: "update-props", elementId: "item", patch: { text: "Hello" } },
      {
        type: "set-style",
        target: { type: "local", elementId: "item" },
        breakpoint: "desktop",
        state: "normal",
        property: "color",
        value: "red",
      },
      { type: "set-hidden", elementId: "item", hidden: true },
      { type: "update-page", title: "Changed", slug: "changed" },
    ]).document;
    expect(document.elements.item).toMatchObject({
      name: "Renamed",
      props: { text: "Hello" },
      hidden: true,
    });
    expect(document).toMatchObject({ title: "Changed", slug: "changed" });
    document = dispatch(document, {
      type: "set-locked",
      elementId: "item",
      locked: true,
    });
    expect(
      builder.editor.can(document, {
        type: "rename",
        elementId: "item",
        name: "No",
      }),
    ).toBe(false);
  });

  it("adds, assigns, reorders, updates, and removes Classes and Variables", () => {
    let document = dispatch(base(), {
      type: "insert",
      parentId: "root",
      index: 0,
      clipboard: clipboard("item"),
    });
    document = dispatch(document, {
      type: "add-class",
      styleClass: { id: "accent", name: "Accent", styles: {} },
    });
    document = dispatch(document, {
      type: "add-class",
      styleClass: { id: "secondary", name: "Secondary", styles: {} },
    });
    document = dispatch(document, {
      type: "reorder-class",
      classId: "secondary",
      index: 0,
    });
    document = dispatch(document, {
      type: "assign-class",
      elementId: "item",
      classId: "accent",
    });
    document = dispatch(document, {
      type: "rename-class",
      classId: "accent",
      name: "Primary",
    });
    document = dispatch(document, {
      type: "add-variable",
      variable: { id: "brand", name: "Brand", kind: "color", value: "red" },
    });
    document = dispatch(document, {
      type: "add-variable",
      variable: { id: "space", name: "Space", kind: "spacing", value: 8 },
    });
    document = dispatch(document, {
      type: "reorder-variable",
      variableId: "space",
      index: 0,
    });
    document = dispatch(document, {
      type: "update-variable",
      variableId: "brand",
      patch: { value: "blue" },
    });
    expect(document.classes.accent?.name).toBe("Primary");
    expect(document.variables.brand?.value).toBe("blue");
    expect(() =>
      builder.editor.dispatch(document, {
        type: "delete-class",
        classId: "accent",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_COMMAND" }));
    document = dispatch(document, {
      type: "unassign-class",
      elementId: "item",
      classId: "accent",
    });
    document = dispatch(document, { type: "delete-class", classId: "accent" });
    document = dispatch(document, {
      type: "delete-class",
      classId: "secondary",
    });
    document = dispatch(document, {
      type: "delete-variable",
      variableId: "brand",
    });
    document = dispatch(document, {
      type: "delete-variable",
      variableId: "space",
    });
    expect(document.classOrder).toEqual([]);
    expect(document.variableOrder).toEqual([]);
  });

  it("replaces complete styles and settings", () => {
    let document = dispatch(base(), {
      type: "replace-styles",
      elementId: "root",
      styles: { desktop: { normal: { display: "grid" } } },
    });
    document = dispatch(document, {
      type: "update-settings",
      settings: { ...document.settings, contentWidth: 960 },
    });
    expect(document.elements.root?.styles).toMatchObject({
      desktop: { normal: { display: "grid" } },
    });
    expect(document.settings.contentWidth).toBe(960);
  });

  it("refuses root operations, circular moves, invalid indexes, and locked removal", () => {
    let document = dispatch(base(), {
      type: "insert",
      parentId: "root",
      index: 0,
      clipboard: clipboard("item"),
    });
    for (const command of [
      { type: "remove", elementId: "root" },
      { type: "move", elementId: "item", parentId: "item", index: 0 },
      {
        type: "insert",
        parentId: "root",
        index: 4,
        clipboard: clipboard("bad"),
      },
    ] satisfies EditorCommand[])
      expect(() => builder.editor.dispatch(document, command)).toThrow();
    document = dispatch(document, {
      type: "set-locked",
      elementId: "item",
      locked: true,
    });
    expect(() =>
      builder.editor.dispatch(document, { type: "remove", elementId: "item" }),
    ).toThrowError(expect.objectContaining({ code: "LOCKED_ELEMENT" }));
  });

  it("supports bounded, coalesced, branching Local history with undo and redo", () => {
    let history = builder.editor.history.create(base(), 2);
    history = builder.editor.history.commit(
      history,
      { type: "update-page", title: "A" },
      { coalesceKey: "title", timestamp: 100 },
    );
    history = builder.editor.history.commit(
      history,
      { type: "update-page", title: "AB" },
      { coalesceKey: "title", timestamp: 200 },
    );
    expect(history.past).toHaveLength(1);
    history = builder.editor.history.undo(history);
    expect(history.present.title).toBe("Untitled page");
    history = builder.editor.history.redo(history);
    expect(history.present.title).toBe("AB");
    history = builder.editor.history.undo(history);
    history = builder.editor.history.commit(history, {
      type: "update-page",
      title: "Branch",
    });
    expect(history.future).toHaveLength(0);
    history = builder.editor.history.commit(history, {
      type: "update-page",
      slug: "branch-one",
    });
    history = builder.editor.history.commit(history, {
      type: "update-page",
      slug: "branch-two",
    });
    expect(history.past).toHaveLength(2);
  });

  it("rolls back atomic multi-command transactions when a command refuses", () => {
    const document = base();
    const snapshot = structuredClone(document);
    expect(() =>
      builder.editor.dispatchMany(document, [
        { type: "update-page", title: "Transient" },
        { type: "remove", elementId: "root" },
      ]),
    ).toThrowError(expect.objectContaining({ code: "ROOT_OPERATION" }));
    expect(document).toEqual(snapshot);
  });

  it("remaps clipboard Element IDs and internal references without collisions", () => {
    const nested: PagebldrClipboard = {
      ...clipboard("parent"),
      elements: {
        parent: {
          ...element("parent"),
          children: ["child"],
          props: { destination: { elementId: "child" } },
        },
        child: element("child"),
      },
    };
    let document = dispatch(base(), {
      type: "insert",
      parentId: "root",
      index: 0,
      clipboard: nested,
    });
    document = dispatch(document, {
      type: "duplicate",
      elementId: "parent",
      idFactory: createSequentialIdFactory("mapped"),
    });
    const duplicate = document.elements[document.elements.root!.children[1]!]!;
    expect(duplicate.id).not.toBe("parent");
    expect(
      (duplicate.props.destination as { elementId: string }).elementId,
    ).toBe(duplicate.children[0]);
  });

  it("preserves invariants through deterministic arbitrary valid command sequences", () => {
    let document = base();
    for (let index = 0; index < 100; index += 1) {
      const id = `node-${index}`;
      document = dispatch(document, {
        type: "insert",
        parentId: "root",
        index: document.elements.root!.children.length,
        clipboard: clipboard(id),
      });
      if (index % 3 === 0)
        document = dispatch(document, {
          type: "update-props",
          elementId: id,
          patch: { index },
        });
      if (index % 5 === 0)
        document = dispatch(document, {
          type: "set-hidden",
          elementId: id,
          hidden: true,
        });
      expect(builder.documents.validate(document).valid).toBe(true);
    }
  });

  it("preserves invariants for property-generated command sequences", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            hidden: fc.boolean(),
            text: fc.string({ maxLength: 20 }),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        (steps) => {
          let document = base();
          steps.forEach((step, index) => {
            const id = `property-${index}`;
            document = dispatch(document, {
              type: "insert",
              parentId: "root",
              index,
              clipboard: clipboard(id),
            });
            document = builder.editor.dispatchMany(document, [
              {
                type: "update-props",
                elementId: id,
                patch: { text: step.text },
              },
              ...(step.hidden
                ? ([
                    { type: "set-hidden", elementId: id, hidden: true },
                  ] satisfies EditorCommand[])
                : []),
            ]).document;
          });
          expect(builder.documents.validate(document).valid).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("edits the 500-Element fixture within a focused performance guardrail", () => {
    const start = performance.now();
    const transaction = builder.editor.dispatch(
      createFiveHundredElementFixture(),
      {
        type: "rename",
        elementId: "element-499",
        name: "Last",
      },
    );
    expect(transaction.document.elements["element-499"]?.name).toBe("Last");
    expect(performance.now() - start).toBeLessThan(250);
  });
});

function base(): PageDocument {
  return builder.documents.create({ id: "page" });
}
function dispatch(
  document: PageDocument,
  command: EditorCommand,
): PageDocument {
  return builder.editor.dispatch(document, command).document;
}
function clipboard(id: string): PagebldrClipboard {
  return {
    format: "pagebldr-clipboard",
    schemaVersion: 1,
    rootId: id,
    elements: { [id]: element(id) },
    classes: {},
    classOrder: [],
    variables: {},
    variableOrder: [],
  };
}
function element(id: string): PageElement {
  return {
    id,
    type: "container",
    elementVersion: 1,
    name: id,
    props: {},
    children: [],
    classIds: [],
    styles: {},
    locked: false,
    hidden: false,
  };
}
