import { cloneDocument } from "./document.js";
import type {
  PageDocument,
  PageElement,
  PageSettings,
  StyleClass,
  StyleVariable,
} from "./document-types.js";

export type DocumentPatch =
  | {
      readonly op: "element";
      readonly id: string;
      readonly before: PageElement | null;
      readonly after: PageElement | null;
    }
  | {
      readonly op: "class";
      readonly id: string;
      readonly before: StyleClass | null;
      readonly after: StyleClass | null;
    }
  | {
      readonly op: "variable";
      readonly id: string;
      readonly before: StyleVariable | null;
      readonly after: StyleVariable | null;
    }
  | {
      readonly op: "classOrder";
      readonly before: readonly string[];
      readonly after: readonly string[];
    }
  | {
      readonly op: "variableOrder";
      readonly before: readonly string[];
      readonly after: readonly string[];
    }
  | {
      readonly op: "page";
      readonly before: Pick<PageDocument, "title" | "slug">;
      readonly after: Pick<PageDocument, "title" | "slug">;
    }
  | {
      readonly op: "settings";
      readonly before: PageSettings;
      readonly after: PageSettings;
    };

const equal = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export function diffDocuments(
  before: PageDocument,
  after: PageDocument,
): DocumentPatch[] {
  const patches: DocumentPatch[] = [];
  diffRecord("element", before.elements, after.elements, patches);
  diffRecord("class", before.classes, after.classes, patches);
  diffRecord("variable", before.variables, after.variables, patches);
  if (!equal(before.classOrder, after.classOrder))
    patches.push({
      op: "classOrder",
      before: before.classOrder,
      after: after.classOrder,
    });
  if (!equal(before.variableOrder, after.variableOrder))
    patches.push({
      op: "variableOrder",
      before: before.variableOrder,
      after: after.variableOrder,
    });
  const beforePage = { title: before.title, slug: before.slug };
  const afterPage = { title: after.title, slug: after.slug };
  if (!equal(beforePage, afterPage))
    patches.push({ op: "page", before: beforePage, after: afterPage });
  if (!equal(before.settings, after.settings))
    patches.push({
      op: "settings",
      before: before.settings,
      after: after.settings,
    });
  return patches;
}

function diffRecord(
  op: "element" | "class" | "variable",
  before: Readonly<Record<string, PageElement | StyleClass | StyleVariable>>,
  after: Readonly<Record<string, PageElement | StyleClass | StyleVariable>>,
  patches: DocumentPatch[],
): void {
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const left = before[id] ?? null;
    const right = after[id] ?? null;
    if (!equal(left, right))
      patches.push({ op, id, before: left, after: right } as DocumentPatch);
  }
}

export function invertPatches(
  patches: readonly DocumentPatch[],
): DocumentPatch[] {
  return [...patches].reverse().map(
    (patch) =>
      ({
        ...patch,
        before: patch.after,
        after: patch.before,
      }) as DocumentPatch,
  );
}

export function applyPatches(
  source: PageDocument,
  patches: readonly DocumentPatch[],
): PageDocument {
  const document = cloneDocument(source) as MutableDocument;
  for (const patch of patches) {
    if (
      patch.op === "element" ||
      patch.op === "class" ||
      patch.op === "variable"
    ) {
      const record =
        patch.op === "element"
          ? document.elements
          : patch.op === "class"
            ? document.classes
            : document.variables;
      if (patch.after) record[patch.id] = structuredClone(patch.after);
      else delete record[patch.id];
    } else if (patch.op === "classOrder")
      document.classOrder = [...patch.after];
    else if (patch.op === "variableOrder")
      document.variableOrder = [...patch.after];
    else if (patch.op === "page") Object.assign(document, patch.after);
    else document.settings = structuredClone(patch.after);
  }
  return document;
}

export type MutableElement = Omit<
  PageElement,
  | "id"
  | "name"
  | "props"
  | "children"
  | "classIds"
  | "styles"
  | "locked"
  | "hidden"
> & {
  id: string;
  name: string;
  props: Record<string, unknown>;
  children: string[];
  classIds: string[];
  styles: PageElement["styles"];
  locked: boolean;
  hidden: boolean;
};

export type MutableDocument = Omit<
  PageDocument,
  | "title"
  | "slug"
  | "elements"
  | "classes"
  | "variables"
  | "classOrder"
  | "variableOrder"
  | "settings"
> & {
  title: string;
  slug: string;
  elements: Record<string, MutableElement>;
  classes: Record<string, StyleClass>;
  variables: Record<string, StyleVariable>;
  classOrder: string[];
  variableOrder: string[];
  settings: PageSettings;
};
