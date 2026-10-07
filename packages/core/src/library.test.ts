import { describe, expect, it } from "vitest";
import {
  createPagebldr,
  createSequentialIdFactory,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "./index.js";

const builder = createPagebldr({
  namespace: "library-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

function template(): PageDocument {
  const document = builder.documents.create({
    id: "template",
    rootId: "section",
  });
  const root = document.elements.section!;
  const button = builder.elements.get("button")!;
  return {
    ...document,
    elements: {
      section: { ...root, children: ["action"], classIds: ["shared-heading"] },
      action: {
        ...root,
        id: "action",
        type: "button",
        elementVersion: button.version,
        name: "Action",
        props: {
          label: "Continue",
          destination: { type: "anchor", elementId: "section" },
        },
      },
    },
    classes: {
      "shared-heading": {
        id: "shared-heading",
        name: "Heading",
        styles: {
          desktop: {
            normal: { color: { type: "variable", variableId: "shared-brand" } },
          },
        },
      },
      unused: { id: "unused", name: "Unused", styles: {} },
    },
    classOrder: ["shared-heading", "unused"],
    variables: {
      "shared-brand": {
        id: "shared-brand",
        name: "Brand",
        kind: "color",
        value: "#123456",
      },
      unused: { id: "unused", name: "Unused", kind: "spacing", value: "16px" },
    },
    variableOrder: ["shared-brand", "unused"],
  };
}

describe("library source characterization", () => {
  it("clones Templates with fresh IDs and remaps internal anchor destinations", () => {
    const source = template();
    const before = structuredClone(source);
    const cloned = builder.editor.library.cloneTemplate(
      source,
      createSequentialIdFactory("fresh"),
    );
    expect(cloned.id).not.toBe(source.id);
    expect(
      Object.keys(cloned.elements).some((id) => id in source.elements),
    ).toBe(false);
    const action = Object.values(cloned.elements).find(
      (element) => element.type === "button",
    )!;
    expect(action.props.destination).toEqual({
      type: "anchor",
      elementId: cloned.rootId,
    });
    expect(cloned.classes).toEqual(source.classes);
    expect(cloned.variables).toEqual(source.variables);
    expect(cloned.settings).toEqual(source.settings);
    expect(cloned.classes).not.toBe(source.classes);
    expect(source).toEqual(before);
    expect(builder.documents.validate(cloned).valid).toBe(true);
  });

  it("applies cloned Templates atomically, preserves identity and supports undo/redo", () => {
    const destination = builder.documents.create({
      id: "page",
      title: "My page",
      slug: "my-page",
    });
    const source = template();
    const cloned = builder.editor.library.cloneTemplate(source);
    const initial = builder.editor.history.create(destination);
    const applied = builder.editor.history.commit(initial, {
      type: "apply-template",
      template: cloned,
    });
    expect(applied.present).toMatchObject({
      id: destination.id,
      title: destination.title,
      slug: destination.slug,
      rootId: destination.rootId,
      settings: { seo: destination.settings.seo },
    });
    const action = Object.values(applied.present.elements).find(
      (element) => element.type === "button",
    )!;
    expect(action.props.destination).toEqual({
      type: "anchor",
      elementId: destination.rootId,
    });
    const undone = builder.editor.history.undo(applied);
    expect(undone.present).toEqual(destination);
    expect(builder.editor.history.redo(undone).present).toEqual(
      applied.present,
    );
  });

  it("reuses customized page dependencies when inserting library Blocks", () => {
    const source = template();
    const destination: PageDocument = {
      ...builder.documents.create({ id: "page" }),
      classes: {
        "shared-heading": {
          ...source.classes["shared-heading"]!,
          name: "Customized heading",
        },
      },
      classOrder: ["shared-heading"],
      variables: {
        "shared-brand": {
          ...source.variables["shared-brand"]!,
          value: "#abcdef",
        },
      },
      variableOrder: ["shared-brand"],
    };
    const clipboard = builder.editor.clipboard.copy(source, source.rootId);
    const before = structuredClone([clipboard, destination]);
    const prepared = builder.editor.library.prepareBlock(
      clipboard,
      destination,
      createSequentialIdFactory("block"),
    );
    expect(prepared.classes["shared-heading"]).toEqual(
      destination.classes["shared-heading"],
    );
    expect(prepared.classes["shared-heading"]).not.toBe(
      destination.classes["shared-heading"],
    );
    const inserted = builder.editor.dispatch(destination, {
      type: "insert",
      parentId: destination.rootId,
      index: 0,
      clipboard: prepared,
    }).document;
    expect(inserted.variables["shared-brand"]?.value).toBe("#abcdef");
    expect(inserted.classes["shared-heading"]?.name).toBe("Customized heading");
    expect(inserted.elements[prepared.rootId]?.classIds).toEqual([
      "shared-heading",
    ]);
    expect(builder.documents.validate(inserted).valid).toBe(true);
    expect([clipboard, destination]).toEqual(before);
  });

  it("inserts the same saved Block repeatedly without ID collisions", () => {
    const source = template();
    const clipboard = builder.editor.clipboard.copy(source, source.rootId);
    const ids = createSequentialIdFactory("saved");
    let destination = builder.documents.create({ id: "page" });
    for (let index = 0; index < 3; index++) {
      const prepared = builder.editor.library.prepareBlock(
        clipboard,
        destination,
        ids,
      );
      destination = builder.editor.dispatch(destination, {
        type: "insert",
        parentId: destination.rootId,
        index,
        clipboard: prepared,
      }).document;
    }
    expect(Object.keys(destination.elements)).toHaveLength(7);
    expect(destination.elements[destination.rootId]?.children).toHaveLength(3);
    expect(builder.documents.validate(destination).valid).toBe(true);
  });

  it("rejects invalid Templates before allocating IDs", () => {
    let calls = 0;
    expect(() =>
      builder.editor.library.cloneTemplate(
        { ...template(), rootId: "missing" },
        () => {
          calls++;
          return "fresh";
        },
      ),
    ).toThrow();
    expect(calls).toBe(0);
  });

  it("rejects reused generated IDs instead of silently overwriting Elements", () => {
    const source = template();
    expect(() =>
      builder.editor.library.cloneTemplate(source, () => source.id),
    ).toThrow("reused");
    expect(() =>
      builder.editor.library.cloneTemplate(source, () => "same"),
    ).toThrow("reused");
    const destination = builder.documents.create({ id: "page" });
    expect(() =>
      builder.editor.library.prepareBlock(
        builder.editor.clipboard.copy(source, source.rootId),
        destination,
        () => destination.rootId,
      ),
    ).toThrow("reused");
  });

  it("keeps invalid Block insertion at the command validation boundary", () => {
    const source = template();
    const clipboard = builder.editor.clipboard.copy(source, source.rootId);
    const destination = builder.documents.create({ id: "page" });
    const prepared = builder.editor.library.prepareBlock(
      {
        ...clipboard,
        elements: {
          ...clipboard.elements,
          action: { ...clipboard.elements.action!, type: "unregistered" },
        },
      },
      destination,
    );
    expect(() =>
      builder.editor.dispatch(destination, {
        type: "insert",
        parentId: destination.rootId,
        index: 0,
        clipboard: prepared,
      }),
    ).toThrow();
    expect(destination.elements[destination.rootId]?.children).toEqual([]);
    expect(() =>
      builder.editor.library.prepareBlock(
        { ...clipboard, schemaVersion: 2 } as unknown as typeof clipboard,
        destination,
      ),
    ).toThrow("format");
  });
});
