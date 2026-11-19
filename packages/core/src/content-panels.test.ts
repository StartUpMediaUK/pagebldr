import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createPagebldr,
  createSequentialIdFactory,
  defineElement,
  extractDocumentReferences,
  resolveDocumentResources,
  standardElements,
  standardStyleCapabilities,
  validatePublication,
  type PageDocument,
  type PageElement,
} from "./index.js";

const host = defineElement({
  type: "host-form",
  version: 1,
  label: "Host form",
  props: z
    .object({
      reference: z.object({
        kind: z.literal("form"),
        value: z.object({ elementId: z.string() }),
      }),
    })
    .strict(),
  defaults: () => ({
    reference: { kind: "form" as const, value: { elementId: "panel" } },
  }),
  childPolicy: { kind: "none" },
  references: (props) => [props.reference],
});
const builder = createPagebldr({
  namespace: "content-tests",
  elements: [...standardElements, host],
  styleCapabilities: standardStyleCapabilities,
  resources: {
    form: {
      reference: z.object({ elementId: z.string() }),
      resolve: () => "host:available",
    },
  },
});

function panelFixture(kind: "tabs" | "accordion"): PageDocument {
  const base = builder.documents.create({ id: "panels" });
  const element = (
    id: string,
    type: string,
    children: readonly string[] = [],
    props = {},
  ): PageElement => ({
    ...base.elements.root!,
    id,
    type,
    name: id,
    elementVersion: builder.elements.get(type)!.version,
    props: {
      ...(builder.elements.get(type)!.defaults() as Record<string, unknown>),
      ...props,
    },
    children,
  });
  return {
    ...base,
    elements: {
      root: { ...base.elements.root!, children: ["tabs"] },
      tabs: element(
        "tabs",
        kind === "tabs" ? "content-tabs" : "content-accordion",
        ["panel", "other"],
        {
          anchorId: "sections",
        },
      ),
      panel: element(
        "panel",
        kind === "tabs" ? "tab-panel" : "accordion-panel",
        ["form"],
      ),
      form: element("form", "host-form"),
      other: element(
        "other",
        kind === "tabs" ? "tab-panel" : "accordion-panel",
      ),
    },
  };
}

describe.each(["tabs", "accordion"] as const)(
  "editable %s panel contract",
  (kind) => {
    const fixture = () => panelFixture(kind);
    it("enforces one normal-tree owner and rejects invalid reparenting atomically", () => {
      const source = fixture();
      expect(builder.documents.validate(source).valid).toBe(true);
      for (const command of [
        {
          type: "move" as const,
          elementId: "panel",
          parentId: "root",
          index: 1,
        },
        {
          type: "move" as const,
          elementId: "form",
          parentId: "tabs",
          index: 0,
        },
        {
          type: "move" as const,
          elementId: "tabs",
          parentId: "panel",
          index: 0,
        },
      ])
        expect(() => builder.editor.dispatch(source, command)).toThrow();
      expect(source).toEqual(fixture());
    });

    it("duplicates the owned subtree with fresh identities and keeps opaque Host identities", () => {
      const source = fixture();
      const duplicated = builder.editor.dispatch(source, {
        type: "duplicate",
        elementId: "panel",
        idFactory: createSequentialIdFactory("copy"),
      }).document;
      const panels = duplicated.elements.tabs!.children;
      expect(panels).toHaveLength(3);
      const copy = duplicated.elements[panels[1]!]!;
      expect(copy.id).not.toBe("panel");
      expect(copy.children[0]).not.toBe("form");
      expect(duplicated.elements[copy.children[0]!]!.props).toEqual(
        source.elements.form!.props,
      );
      expect(extractDocumentReferences(builder, duplicated)).toEqual([
        { kind: "form", value: { elementId: "panel" } },
      ]);
    });

    it("reorders and renames a panel without separating its label from its answer tree", () => {
      const source = fixture();
      const key = kind === "tabs" ? "label" : "question";
      const renamed = builder.editor.dispatch(source, {
        type: "update-props",
        elementId: "panel",
        patch: { [key]: "Updated question" },
      }).document;
      const moved = builder.editor.dispatch(renamed, {
        type: "move",
        elementId: "panel",
        parentId: "tabs",
        index: 1,
      }).document;
      expect(moved.elements.tabs!.children).toEqual(["other", "panel"]);
      expect(moved.elements.panel!.props[key]).toBe("Updated question");
      expect(moved.elements.panel!.children).toEqual(["form"]);
      expect(moved.elements.form).toEqual(source.elements.form);
    });

    it("removes owned descendants and restores exact structure with undo/redo", () => {
      const original = builder.editor.history.create(fixture());
      const removed = builder.editor.history.commit(original, {
        type: "remove",
        elementId: "panel",
      });
      expect(removed.present.elements.form).toBeUndefined();
      expect(removed.present.elements.panel).toBeUndefined();
      expect(builder.editor.history.undo(removed).present).toEqual(
        original.present,
      );
      expect(
        builder.editor.history.redo(builder.editor.history.undo(removed))
          .present,
      ).toEqual(removed.present);
      expect(
        builder.documents.parse(JSON.parse(JSON.stringify(removed.present))),
      ).toEqual(removed.present);
    });

    it("applies a panel editing session atomically and rejects stale or out-of-scope saves", () => {
      const base = fixture();
      const label = kind === "tabs" ? "label" : "question";
      const first = builder.editor.dispatch(base, {
        type: "update-props",
        elementId: "panel",
        patch: { [label]: "Edited panel" },
      }).document;
      const draft = builder.editor.dispatch(first, {
        type: "duplicate",
        elementId: "form",
        idFactory: createSequentialIdFactory("draft"),
      }).document;
      const command = {
        type: "apply-subtree" as const,
        elementId: "panel",
        baseDocument: base,
        document: draft,
      };
      const history = builder.editor.history.commit(
        builder.editor.history.create(base),
        command,
      );
      expect(history.past).toHaveLength(1);
      expect(history.present).toEqual(draft);
      expect(builder.editor.history.undo(history).present).toEqual(base);
      expect(
        builder.editor.history.redo(builder.editor.history.undo(history))
          .present,
      ).toEqual(draft);
      expect(history.present.elements.other).toEqual(base.elements.other);
      const roundTrip = builder.documents.deserialize(
        builder.documents.serialize(base),
      );
      expect(builder.editor.dispatch(roundTrip, command).document).toEqual(
        draft,
      );
      const unrelated = builder.editor.dispatch(base, {
        type: "rename",
        elementId: "other",
        name: "Another change",
      }).document;
      expect(() => builder.editor.dispatch(unrelated, command)).toThrow(
        /page changed/,
      );
      const escaped = builder.editor.dispatch(draft, {
        type: "rename",
        elementId: "other",
        name: "Outside",
      }).document;
      expect(() =>
        builder.editor.dispatch(base, { ...command, document: escaped }),
      ).toThrow(/outside/);
      const locked = {
        ...base,
        elements: {
          ...base.elements,
          form: { ...base.elements.form!, locked: true },
        },
      };
      expect(() =>
        builder.editor.dispatch(locked, { ...command, baseDocument: locked }),
      ).toThrow();
      expect(base).toEqual(fixture());
    });

    it("prepares and inserts panels repeatedly with fresh anchors and non-destructive style collisions", async () => {
      const source: PageDocument = {
        ...fixture(),
        classes: {
          incoming: {
            id: "incoming",
            name: "Brand",
            styles: {
              desktop: {
                normal: { color: { type: "variable", variableId: "incoming" } },
              },
            },
          },
        },
        classOrder: ["incoming"],
        variables: {
          incoming: {
            id: "incoming",
            name: "Brand",
            kind: "color",
            value: "#123456",
          },
        },
        variableOrder: ["incoming"],
      };
      const styled = {
        ...source,
        elements: {
          ...source.elements,
          tabs: { ...source.elements.tabs!, classIds: ["incoming"] },
        },
      };
      let destination: PageDocument = {
        ...builder.documents.create({ id: "destination" }),
        classes: { existing: { id: "existing", name: "Brand", styles: {} } },
        classOrder: ["existing"],
        variables: {
          existing: {
            id: "existing",
            name: "Brand",
            kind: "color",
            value: "#abcdef",
          },
        },
        variableOrder: ["existing"],
      };
      const ids = createSequentialIdFactory("block");
      for (let index = 0; index < 2; index++) {
        const clipboard = builder.editor.library.prepareBlock(
          builder.editor.clipboard.copy(styled, "tabs"),
          destination,
          ids,
        );
        destination = builder.editor.dispatch(destination, {
          type: "insert",
          parentId: "root",
          index,
          clipboard,
        }).document;
      }
      expect(destination.classes.incoming?.name).toBe("Brand (2)");
      expect(destination.variables.incoming?.name).toBe("Brand (2)");
      expect(destination.variables.existing?.value).toBe("#abcdef");
      expect(
        new Set(
          Object.values(destination.elements).flatMap((element) =>
            element.props.anchorId ? [element.props.anchorId] : [],
          ),
        ).size,
      ).toBe(2);
      const clone = builder.editor.library.cloneTemplate(destination, ids);
      expect(builder.documents.validate(clone).valid).toBe(true);
      expect(await resolveDocumentResources(builder, clone)).toEqual({
        values: new Map([['form:{"elementId":"panel"}', "host:available"]]),
      });
      expect(
        builder.documents.parse(JSON.parse(JSON.stringify(destination))),
      ).toEqual(destination);
      expect(await validatePublication(builder, destination)).toEqual([]);
    });

    it("preserves version-one text Tabs and FAQs without rewriting their authored content", () => {
      const base = fixture();
      const old = builder.elements.get("tabs")!;
      const faq = builder.elements.get("accordion")!;
      const source = {
        ...base,
        elements: {
          root: { ...base.elements.root!, children: ["text", "faq"] },
          text: {
            ...base.elements.other!,
            id: "text",
            type: "tabs",
            props: old.defaults(),
            children: [],
          },
          faq: {
            ...base.elements.other!,
            id: "faq",
            type: "accordion",
            props: faq.defaults(),
            children: [],
          },
        },
      };
      expect(builder.documents.migrate(source)).toEqual(source);
    });

    it("validates recursive menus, their destinations, unique IDs and depth limit", () => {
      const menu = builder.elements.get("menu")!;
      const defaults = menu.defaults() as Record<string, unknown>;
      const leaf = {
        id: "leaf",
        label: "Leaf",
        destination: {
          type: "application",
          reference: { kind: "form", value: { elementId: "panel" } },
        },
      };
      const items = [
        {
          id: "parent",
          label: "Parent",
          children: [{ id: "middle", label: "Middle", children: [leaf] }],
        },
      ];
      expect(
        menu.props["~standard"].validate({ ...defaults, items }),
      ).toHaveProperty("value");
      expect(menu.references?.({ ...defaults, items })).toEqual([
        leaf.destination.reference,
      ]);
      expect(menu.destinations?.({ ...defaults, items })).toEqual([
        leaf.destination,
      ]);
      expect(
        menu.props["~standard"].validate({
          ...defaults,
          items: [...items, leaf, leaf],
        }),
      ).toHaveProperty("issues");
      expect(
        menu.props["~standard"].validate({
          ...defaults,
          items: [{ id: "extra", label: "Too deep", children: items }],
        }),
      ).toHaveProperty("issues");
    });
  },
);
