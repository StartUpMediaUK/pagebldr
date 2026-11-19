import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import { describe, expect, it } from "vitest";
import {
  createElementClipboard,
  resolveClickInsertion,
  resolveKeyboardMove,
} from "./canvas-placement.js";
import { chooseDefaultTab, convertTextTabs } from "./panel-content-control.js";

const builder = createPagebldr({
  namespace: "panel-canvas",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
describe("panel content authoring", () => {
  it("inserts editable Tabs with three individually owned empty panels", () => {
    const base = builder.documents.create({ id: "page" });
    const clipboard = createElementClipboard(
      builder.elements.get("content-tabs")!,
    );
    const inserted = builder.editor.dispatch(base, {
      type: "insert",
      parentId: base.rootId,
      index: 0,
      clipboard,
    }).document;
    const tabs = inserted.elements[clipboard.rootId]!;
    expect(tabs.children).toHaveLength(3);
    expect(new Set(tabs.children).size).toBe(3);
    for (const id of tabs.children)
      expect(inserted.elements[id]?.type).toBe("tab-panel");
    const scoped = { ...inserted, rootId: tabs.children[0]! };
    expect(
      resolveClickInsertion({
        document: scoped,
        definitions: builder.elements,
        elementType: "heading",
        selectedId: scoped.rootId,
      }),
    ).toMatchObject({ parentId: scoped.rootId, index: 0 });
    expect(
      resolveKeyboardMove({
        document: scoped,
        definitions: builder.elements,
        elementId: scoped.rootId,
        direction: "out",
      }),
    ).toBeNull();
  });
  it("chooses a single default atomically, preserves ownership, and supports undo and reload", () => {
    const base = builder.documents.create({ id: "page" });
    const clipboard = createElementClipboard(
      builder.elements.get("content-tabs")!,
    );
    const source = builder.editor.dispatch(base, {
      type: "insert",
      parentId: base.rootId,
      index: 0,
      clipboard,
    }).document;
    const tabs = source.elements[clipboard.rootId]!;
    const selected = tabs.children[2]!;
    const draft = chooseDefaultTab(source, tabs.id, selected);
    const history = builder.editor.history.commit(
      builder.editor.history.create(source),
      {
        type: "apply-subtree",
        elementId: tabs.id,
        baseDocument: source,
        document: draft,
      },
    );
    expect(
      tabs.children.map(
        (id) => history.present.elements[id]!.props.defaultOpen,
      ),
    ).toEqual([false, false, true]);
    expect(history.present.elements[tabs.id]).toEqual(tabs);
    expect(builder.editor.history.undo(history).present).toEqual(source);
    expect(
      builder.documents.parse(JSON.parse(JSON.stringify(history.present))),
    ).toEqual(history.present);
    expect(chooseDefaultTab(history.present, tabs.id, selected)).toBe(
      history.present,
    );
    expect(chooseDefaultTab(source, tabs.id, base.rootId)).toBe(source);
    const locked = {
      ...source,
      elements: {
        ...source.elements,
        [tabs.children[0]!]: {
          ...source.elements[tabs.children[0]!]!,
          locked: true,
        },
      },
    };
    expect(chooseDefaultTab(locked, tabs.id, selected)).toBe(locked);
    const hidden = {
      ...source,
      elements: {
        ...source.elements,
        [selected]: { ...source.elements[selected]!, hidden: true },
      },
    };
    expect(chooseDefaultTab(hidden, tabs.id, selected)).toBe(hidden);
  });
  it("converts text Tabs without losing authored content, root identity, anchors or unrelated page content", () => {
    const base = builder.documents.create({ id: "page" });
    const clipboard = createElementClipboard(builder.elements.get("tabs")!);
    const source = builder.editor.dispatch(base, {
      type: "insert",
      parentId: base.rootId,
      index: 0,
      clipboard,
    }).document;
    const anchored = builder.editor.dispatch(source, {
      type: "update-props",
      elementId: clipboard.rootId,
      patch: { anchorId: "details" },
    }).document;
    const converted = convertTextTabs(
      anchored,
      clipboard.rootId,
      builder.elements.get("content-tabs")!.defaults() as Record<
        string,
        unknown
      >,
    );
    const saved = builder.editor.history.commit(
      builder.editor.history.create(anchored),
      {
        type: "apply-subtree",
        elementId: clipboard.rootId,
        baseDocument: anchored,
        document: converted,
      },
    );
    expect(builder.documents.validate(saved.present).valid).toBe(true);
    const tabs = saved.present.elements[clipboard.rootId]!;
    expect(tabs.type).toBe("content-tabs");
    expect(tabs.props.anchorId).toBe("details");
    const old = anchored.elements[clipboard.rootId]!.props.items as {
      label: string;
      content: string;
    }[];
    tabs.children.forEach((id, index) => {
      const panel = saved.present.elements[id]!;
      expect(panel.props.label).toBe(old[index]!.label);
      expect(saved.present.elements[panel.children[0]!]!.props.content).toEqual(
        [{ type: "paragraph", text: old[index]!.content }],
      );
    });
    expect(saved.present.elements[base.rootId]).toEqual(
      anchored.elements[base.rootId],
    );
    expect(builder.editor.history.undo(saved).present).toEqual(anchored);
    expect(
      builder.documents.parse(JSON.parse(JSON.stringify(saved.present))),
    ).toEqual(saved.present);
  });
});
