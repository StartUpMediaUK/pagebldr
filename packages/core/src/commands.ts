import { cloneDocument } from "./document.js";
import type {
  PageDocument,
  PageElement,
  PageSettings,
  ResponsiveStyles,
  StyleClass,
  StyleValue,
  StyleVariable,
} from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import { createId, type IdFactory } from "./ids.js";
import {
  diffDocuments,
  invertPatches,
  type DocumentPatch,
  type MutableDocument,
  type MutableElement,
} from "./patches.js";
import {
  remapClipboard,
  serializeSubtree,
  type PagebldrClipboard,
} from "./clipboard.js";
import { PagebldrError } from "./types.js";
import { assertValidDocument } from "./validation.js";

export type EditorCommand =
  | {
      readonly type: "insert";
      readonly parentId: string;
      readonly index: number;
      readonly clipboard: PagebldrClipboard;
    }
  | {
      readonly type: "move";
      readonly elementId: string;
      readonly parentId: string;
      readonly index: number;
    }
  | {
      readonly type: "duplicate";
      readonly elementId: string;
      readonly idFactory?: IdFactory;
    }
  | { readonly type: "remove"; readonly elementId: string }
  | {
      readonly type: "rename";
      readonly elementId: string;
      readonly name: string;
    }
  | {
      readonly type: "set-locked";
      readonly elementId: string;
      readonly locked: boolean;
    }
  | {
      readonly type: "set-hidden";
      readonly elementId: string;
      readonly hidden: boolean;
    }
  | {
      readonly type: "update-props";
      readonly elementId: string;
      readonly patch: Readonly<Record<string, unknown>>;
      readonly unset?: readonly string[];
    }
  | {
      readonly type: "set-style";
      readonly target:
        | { readonly type: "local"; readonly elementId: string }
        | { readonly type: "class"; readonly classId: string };
      readonly breakpoint: "desktop" | "tablet" | "mobile";
      readonly state: "normal" | "hover" | "focusVisible";
      readonly property: string;
      readonly value: StyleValue | null;
    }
  | {
      readonly type: "replace-styles";
      readonly elementId: string;
      readonly styles: ResponsiveStyles;
    }
  | {
      readonly type: "add-class";
      readonly styleClass: StyleClass;
      readonly index?: number;
    }
  | {
      readonly type: "rename-class";
      readonly classId: string;
      readonly name: string;
    }
  | {
      readonly type: "delete-class";
      readonly classId: string;
      readonly force?: boolean;
    }
  | {
      readonly type: "assign-class";
      readonly elementId: string;
      readonly classId: string;
      readonly index?: number;
    }
  | {
      readonly type: "unassign-class";
      readonly elementId: string;
      readonly classId: string;
    }
  | {
      readonly type: "reorder-class";
      readonly classId: string;
      readonly index: number;
    }
  | {
      readonly type: "add-variable";
      readonly variable: StyleVariable;
      readonly index?: number;
    }
  | {
      readonly type: "update-variable";
      readonly variableId: string;
      readonly patch: Partial<Omit<StyleVariable, "id">>;
    }
  | {
      readonly type: "delete-variable";
      readonly variableId: string;
      readonly force?: boolean;
    }
  | {
      readonly type: "reorder-variable";
      readonly variableId: string;
      readonly index: number;
    }
  | {
      readonly type: "update-page";
      readonly title?: string;
      readonly slug?: string;
    }
  | { readonly type: "update-settings"; readonly settings: PageSettings };

export interface EditorTransaction {
  readonly label: string;
  readonly document: PageDocument;
  readonly forward: readonly DocumentPatch[];
  readonly inverse: readonly DocumentPatch[];
  readonly changedElementIds: readonly string[];
  readonly command: EditorCommand["type"];
}

export interface DocumentChangeEvent {
  readonly document: PageDocument;
  readonly command: EditorCommand["type"];
  readonly label: string;
  readonly changedElementIds: readonly string[];
}

export function executeCommand(
  source: PageDocument,
  command: EditorCommand,
  definitions: ReadonlyMap<string, ElementDefinition>,
): EditorTransaction {
  assertValidDocument(source, definitions);
  const document = cloneDocument(source) as MutableDocument;
  mutate(document, command, definitions);
  assertValidDocument(document, definitions);
  const forward = diffDocuments(source, document);
  if (forward.length === 0)
    throw new PagebldrError(
      "INVALID_COMMAND",
      "The command did not change the Document.",
    );
  return {
    label: labels[command.type],
    document,
    forward,
    inverse: invertPatches(forward),
    command: command.type,
    changedElementIds: forward
      .filter((patch) => patch.op === "element")
      .map((patch) => patch.id),
  };
}

function mutate(
  document: MutableDocument,
  command: EditorCommand,
  definitions: ReadonlyMap<string, ElementDefinition>,
): void {
  if (command.type === "insert")
    return insert(document, command.parentId, command.index, command.clipboard);
  if (command.type === "duplicate") {
    if (command.elementId === document.rootId) rootRefusal("duplicated");
    const location = parentOf(document, command.elementId);
    const clipboard = remapClipboard(
      serializeSubtree(document, command.elementId),
      command.idFactory ?? createId,
    );
    return insert(document, location.parent.id, location.index + 1, clipboard);
  }
  if (command.type === "remove") {
    if (command.elementId === document.rootId) rootRefusal("removed");
    const location = parentOf(document, command.elementId);
    assertUnlocked(element(document, command.elementId));
    assertUnlocked(location.parent);
    const ids = [
      command.elementId,
      ...descendants(document, command.elementId),
    ];
    for (const id of ids) assertUnlocked(element(document, id));
    location.parent.children = location.parent.children.filter(
      (id) => id !== command.elementId,
    );
    for (const id of ids) delete document.elements[id];
    return;
  }
  if (command.type === "move") {
    if (command.elementId === document.rootId) rootRefusal("moved");
    if (
      command.parentId === command.elementId ||
      descendants(document, command.elementId).includes(command.parentId)
    )
      throw new PagebldrError(
        "CIRCULAR_NESTING",
        "An Element cannot move into its descendant.",
      );
    const from = parentOf(document, command.elementId);
    const target = element(document, command.parentId);
    assertUnlocked(element(document, command.elementId));
    assertUnlocked(from.parent);
    assertUnlocked(target);
    from.parent.children.splice(from.index, 1);
    assertIndex(command.index, target.children.length);
    target.children.splice(command.index, 0, command.elementId);
    return;
  }
  if (
    command.type === "rename" ||
    command.type === "set-hidden" ||
    command.type === "set-locked" ||
    command.type === "update-props" ||
    command.type === "replace-styles"
  ) {
    const target = element(document, command.elementId);
    if (command.type !== "set-locked") assertUnlocked(target);
    if (command.type === "rename") target.name = command.name;
    else if (command.type === "set-hidden") target.hidden = command.hidden;
    else if (command.type === "set-locked") target.locked = command.locked;
    else if (command.type === "replace-styles")
      target.styles = structuredClone(command.styles);
    else {
      target.props = { ...target.props, ...structuredClone(command.patch) };
      for (const key of command.unset ?? []) delete target.props[key];
    }
    return;
  }
  if (command.type === "set-style") {
    const owner =
      command.target.type === "local"
        ? element(document, command.target.elementId)
        : document.classes[command.target.classId];
    if (!owner)
      throw new PagebldrError(
        "BROKEN_REFERENCE",
        "Style owner does not exist.",
      );
    if (command.target.type === "local") assertUnlocked(owner as PageElement);
    const styles = owner.styles as Record<
      string,
      Record<string, Record<string, StyleValue>>
    >;
    const declarations = ((styles[command.breakpoint] ??= {})[command.state] ??=
      {});
    if (command.value === null) delete declarations[command.property];
    else declarations[command.property] = structuredClone(command.value);
    return;
  }
  if (command.type === "add-class") {
    unique(command.styleClass.id, document.classes);
    document.classes[command.styleClass.id] = structuredClone(
      command.styleClass,
    );
    insertOrdered(document.classOrder, command.styleClass.id, command.index);
    return;
  }
  if (command.type === "rename-class") {
    const item = document.classes[command.classId];
    if (!item) missing("Class");
    document.classes[command.classId] = { ...item, name: command.name };
    return;
  }
  if (command.type === "reorder-class") {
    document.classOrder = reorder(
      document.classOrder,
      command.classId,
      command.index,
    );
    return;
  }
  if (command.type === "assign-class" || command.type === "unassign-class") {
    const target = element(document, command.elementId);
    assertUnlocked(target);
    if (!document.classes[command.classId]) missing("Class");
    const exists = target.classIds.includes(command.classId);
    if (command.type === "assign-class") {
      if (exists) refusal("Class is already assigned.");
      const ids = [...target.classIds];
      assertIndex(command.index ?? ids.length, ids.length);
      ids.splice(command.index ?? ids.length, 0, command.classId);
      target.classIds = ids;
    } else {
      if (!exists) refusal("Class is not assigned.");
      target.classIds = target.classIds.filter((id) => id !== command.classId);
    }
    return;
  }
  if (command.type === "delete-class") {
    if (!document.classes[command.classId]) missing("Class");
    const users = Object.values(document.elements).filter((item) =>
      item.classIds.includes(command.classId),
    );
    if (users.length && !command.force) refusal("Class is in use.");
    for (const item of users)
      item.classIds = item.classIds.filter((id) => id !== command.classId);
    delete document.classes[command.classId];
    document.classOrder = document.classOrder.filter(
      (id) => id !== command.classId,
    );
    return;
  }
  if (command.type === "add-variable") {
    unique(command.variable.id, document.variables);
    document.variables[command.variable.id] = structuredClone(command.variable);
    insertOrdered(document.variableOrder, command.variable.id, command.index);
    return;
  }
  if (command.type === "update-variable") {
    const item = document.variables[command.variableId];
    if (!item) missing("Variable");
    document.variables[command.variableId] = {
      ...item,
      ...structuredClone(command.patch),
    };
    return;
  }
  if (command.type === "reorder-variable") {
    document.variableOrder = reorder(
      document.variableOrder,
      command.variableId,
      command.index,
    );
    return;
  }
  if (command.type === "delete-variable") {
    if (!document.variables[command.variableId]) missing("Variable");
    const used = JSON.stringify([document.elements, document.classes]).includes(
      `"variableId":"${command.variableId}"`,
    );
    if (used && !command.force) refusal("Variable is in use.");
    if (used) removeReferences(document, command.variableId);
    delete document.variables[command.variableId];
    document.variableOrder = document.variableOrder.filter(
      (id) => id !== command.variableId,
    );
    return;
  }
  if (command.type === "update-page") {
    if (command.title !== undefined) document.title = command.title;
    if (command.slug !== undefined) document.slug = command.slug;
    return;
  }
  if (command.type === "update-settings")
    document.settings = structuredClone(command.settings);
  void definitions;
}

function insert(
  document: MutableDocument,
  parentId: string,
  index: number,
  clipboard: PagebldrClipboard,
): void {
  const parent = element(document, parentId);
  assertUnlocked(parent);
  assertIndex(index, parent.children.length);
  if (!clipboard.elements[clipboard.rootId])
    throw new PagebldrError("BROKEN_REFERENCE", "Clipboard root is missing.");
  for (const id of Object.keys(clipboard.elements))
    unique(id, document.elements);
  Object.assign(document.elements, structuredClone(clipboard.elements));
  for (const id of clipboard.classOrder)
    if (document.classes[id]) {
      if (
        JSON.stringify(document.classes[id]) !==
        JSON.stringify(clipboard.classes[id])
      ) {
        refusal(`Clipboard Class ${id} conflicts with the Document.`);
      }
    } else {
      document.classes[id] = structuredClone(clipboard.classes[id]!);
      document.classOrder.push(id);
    }
  for (const id of clipboard.variableOrder)
    if (document.variables[id]) {
      if (
        JSON.stringify(document.variables[id]) !==
        JSON.stringify(clipboard.variables[id])
      ) {
        refusal(`Clipboard Variable ${id} conflicts with the Document.`);
      }
    } else {
      document.variables[id] = structuredClone(clipboard.variables[id]!);
      document.variableOrder.push(id);
    }
  parent.children.splice(index, 0, clipboard.rootId);
}
function element(document: MutableDocument, id: string): MutableElement {
  const item = document.elements[id];
  if (!item)
    throw new PagebldrError(
      "ELEMENT_NOT_FOUND",
      `Element ${id} does not exist.`,
    );
  return item;
}
function parentOf(document: MutableDocument, id: string) {
  for (const item of Object.values(document.elements)) {
    const index = item.children.indexOf(id);
    if (index >= 0) return { parent: element(document, item.id), index };
  }
  throw new PagebldrError("INVALID_PARENT", `Element ${id} has no parent.`);
}
function descendants(document: MutableDocument, id: string): string[] {
  const result: string[] = [];
  for (const child of element(document, id).children) {
    result.push(child, ...descendants(document, child));
  }
  return result;
}
function assertUnlocked(item: PageElement): void {
  if (item.locked)
    throw new PagebldrError("LOCKED_ELEMENT", `Element ${item.id} is locked.`);
}
function assertIndex(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index > length)
    refusal(`Index ${index} is outside 0-${length}.`);
}
function unique(id: string, records: Readonly<Record<string, unknown>>): void {
  if (records[id])
    throw new PagebldrError("DUPLICATE_ID", `ID ${id} already exists.`);
}
function insertOrdered(
  order: string[],
  id: string,
  index = order.length,
): void {
  assertIndex(index, order.length);
  order.splice(index, 0, id);
}
function reorder(order: string[], id: string, index: number): string[] {
  if (!order.includes(id))
    throw new PagebldrError("BROKEN_REFERENCE", `Order is missing ${id}.`);
  const next = order.filter((item) => item !== id);
  assertIndex(index, next.length);
  next.splice(index, 0, id);
  return next;
}
function removeReferences(document: MutableDocument, id: string): void {
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        child &&
        typeof child === "object" &&
        (child as { type?: string; variableId?: string }).type === "variable" &&
        (child as { variableId?: string }).variableId === id
      )
        delete (value as Record<string, unknown>)[key];
      else visit(child);
    }
  };
  visit(document.elements);
  visit(document.classes);
}
function refusal(message: string): never {
  throw new PagebldrError("INVALID_COMMAND", message);
}
function missing(label: string): never {
  throw new PagebldrError("BROKEN_REFERENCE", `${label} does not exist.`);
}
function rootRefusal(action: string): never {
  throw new PagebldrError("ROOT_OPERATION", `The root cannot be ${action}.`);
}

const labels: Record<EditorCommand["type"], string> = {
  insert: "Add Element",
  move: "Move Element",
  duplicate: "Duplicate Element",
  remove: "Delete Element",
  rename: "Rename Element",
  "set-locked": "Set lock",
  "set-hidden": "Set visibility",
  "update-props": "Edit properties",
  "set-style": "Edit style",
  "replace-styles": "Edit styles",
  "add-class": "Add Class",
  "rename-class": "Rename Class",
  "delete-class": "Delete Class",
  "assign-class": "Assign Class",
  "unassign-class": "Unassign Class",
  "reorder-class": "Reorder Class",
  "add-variable": "Add Variable",
  "update-variable": "Edit Variable",
  "delete-variable": "Delete Variable",
  "reorder-variable": "Reorder Variable",
  "update-page": "Edit page",
  "update-settings": "Edit settings",
};
