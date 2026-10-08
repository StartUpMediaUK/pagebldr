import {
  createId,
  type Pagebldr,
  type BlockDefinition,
  type PagebldrClipboard,
  type TemplateDefinition,
  type PageDocument,
} from "pagebldr";
import type { EditorLibrarySource } from "pagebldr/react";
import metadata from "../../../fixtures/library/index.json";
import growth from "../../../fixtures/library/growth-bottleneck-audit.document.json";
import study from "../../../fixtures/library/independent-work-study.document.json";
import health from "../../../fixtures/library/business-health-index.document.json";
import pulse from "../../../fixtures/library/business-pulse.document.json";
import solution from "../../../fixtures/library/solution-fit-finder.document.json";
import enquiry from "../../../fixtures/library/project-fit-enquiry.document.json";

// Testing material owned by this private Host, never imported by package code.
const documents = [growth, study, health, pulse, solution, enquiry];
export function referenceTemplate(
  builder: Pagebldr,
  key: string,
): PageDocument | null {
  const index = metadata.findIndex((item) => item.key === key);
  return index < 0
    ? null
    : builder.documents.parse(structuredClone(documents[index]));
}
export function referenceLibrary(builder: Pagebldr): EditorLibrarySource {
  const storageKey = `${builder.namespace}:reference-blocks`;
  const validateClipboard = (value: unknown): PagebldrClipboard => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid saved Block.");
    const document = builder.documents.create({ id: "saved-block-validation" });
    const clipboard = builder.editor.library.prepareBlock(
      value as PagebldrClipboard,
      document,
    );
    const inserted = builder.editor.dispatch(document, {
      type: "insert",
      parentId: document.rootId,
      index: 0,
      clipboard,
    }).document;
    return builder.editor.clipboard.copy(inserted, clipboard.rootId);
  };
  let templates: readonly TemplateDefinition[] = metadata.map(
    (item, index) => ({
      ...item,
      create: () => builder.documents.parse(structuredClone(documents[index])),
    }),
  );
  let blocks: readonly BlockDefinition[] = [];
  try {
    const values: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "[]",
    );
    if (!Array.isArray(values) || values.length > 50)
      throw new Error("Invalid saved Block list.");
    blocks = values.map((item: unknown) => {
      if (
        !item ||
        typeof item !== "object" ||
        !("key" in item) ||
        typeof item.key !== "string" ||
        !("label" in item) ||
        typeof item.label !== "string" ||
        !item.label.trim() ||
        item.label.length > 80 ||
        !("clipboard" in item)
      )
        throw new Error("Invalid saved Block metadata.");
      const clipboard = validateClipboard(item.clipboard);
      return {
        key: item.key,
        label: item.label,
        category: "saved",
        create: () => structuredClone(clipboard),
      };
    });
  } catch {
    /* A malformed Host preference is not an editor failure. */
  }
  const persist = () =>
    localStorage.setItem(
      storageKey,
      JSON.stringify(
        blocks.map((item) => ({
          key: item.key,
          label: item.label,
          clipboard: item.create(),
        })),
      ),
    );
  return {
    listBlocks: () => Promise.resolve(blocks),
    saveBlock: ({ label, clipboard }) => {
      if (!label.trim() || label.trim().length > 80)
        return Promise.reject(new Error("Use a name from 1 to 80 characters."));
      const validated = validateClipboard(clipboard);
      if (blocks.length >= 50)
        return Promise.reject(new Error("Saved Block limit reached."));
      blocks = [
        ...blocks,
        {
          key: createId("saved"),
          label: label.trim(),
          category: "saved",
          create: () => structuredClone(validated),
        },
      ];
      persist();
      return Promise.resolve();
    },
    deleteBlock: (key) => {
      blocks = blocks.filter((item) => item.key !== key);
      persist();
      return Promise.resolve();
    },
    listTemplates: () => Promise.resolve(templates),
    editTemplate: (key) => {
      window.location.hash = `#/editor/template/${key}`;
    },
    deleteTemplate: (key) => {
      templates = templates.filter((item) => item.key !== key);
      return Promise.resolve();
    },
    adaptBlockReferences: (clipboard) => Promise.resolve(clipboard),
    adaptTemplateReferences: (document) => Promise.resolve(document),
  };
}
