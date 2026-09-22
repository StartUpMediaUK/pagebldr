import { buildDocumentIndex } from "./document.js";
import type {
  PageDocument,
  PageElement,
  ResponsiveStyles,
  StyleClass,
  StyleVariable,
} from "./document-types.js";
import type { IdFactory } from "./ids.js";
import { PagebldrError } from "./types.js";

export interface PagebldrClipboard {
  readonly format: "pagebldr-clipboard";
  readonly schemaVersion: 1;
  readonly rootId: string;
  readonly elements: Readonly<Record<string, PageElement>>;
  readonly classes: Readonly<Record<string, StyleClass>>;
  readonly classOrder: readonly string[];
  readonly variables: Readonly<Record<string, StyleVariable>>;
  readonly variableOrder: readonly string[];
}

export interface PagebldrStyleClipboard {
  readonly format: "pagebldr-style-clipboard";
  readonly schemaVersion: 1;
  readonly styles: ResponsiveStyles;
}

export function serializeStyles(
  document: PageDocument,
  elementId: string,
): PagebldrStyleClipboard {
  const element = document.elements[elementId];
  if (!element)
    throw new PagebldrError(
      "ELEMENT_NOT_FOUND",
      `Element ${elementId} does not exist.`,
    );
  return {
    format: "pagebldr-style-clipboard",
    schemaVersion: 1,
    styles: structuredClone(element.styles),
  };
}

export function serializeSubtree(
  document: PageDocument,
  rootId: string,
): PagebldrClipboard {
  const index = buildDocumentIndex(document);
  if (!document.elements[rootId])
    throw new PagebldrError(
      "ELEMENT_NOT_FOUND",
      `Element ${rootId} does not exist.`,
    );
  const ids = [rootId, ...(index.descendantsById.get(rootId) ?? [])];
  const elements = Object.fromEntries(
    ids.map((id) => [id, structuredClone(document.elements[id]!)]),
  );
  const classIds = new Set(
    Object.values(elements).flatMap((element) => element.classIds),
  );
  const classOrder = document.classOrder.filter((id) => classIds.has(id));
  const variableIds = new Set<string>();
  collectVariables(elements, variableIds);
  for (const id of classOrder)
    collectVariables(document.classes[id]?.styles, variableIds);
  const variableOrder = document.variableOrder.filter((id) =>
    variableIds.has(id),
  );
  return {
    format: "pagebldr-clipboard",
    schemaVersion: 1,
    rootId,
    elements,
    classes: Object.fromEntries(
      classOrder.map((id) => [id, structuredClone(document.classes[id]!)]),
    ),
    classOrder,
    variables: Object.fromEntries(
      variableOrder.map((id) => [id, structuredClone(document.variables[id]!)]),
    ),
    variableOrder,
  };
}

function collectVariables(value: unknown, ids: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) collectVariables(child, ids);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "variable" && typeof record.variableId === "string")
    ids.add(record.variableId);
  for (const child of Object.values(record)) collectVariables(child, ids);
}

export function remapClipboard(
  input: PagebldrClipboard,
  idFactory: IdFactory,
): PagebldrClipboard {
  const idMap = new Map(
    Object.keys(input.elements).map((id) => [id, idFactory("element")]),
  );
  const elements = Object.fromEntries(
    Object.values(input.elements).map((element) => {
      const id = idMap.get(element.id);
      if (!id)
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Clipboard Element ${element.id} cannot be remapped.`,
        );
      return [
        id,
        {
          ...structuredClone(element),
          id,
          name: `${element.name} copy`,
          children: element.children.map((child) => idMap.get(child) ?? child),
          props: remapReferences(element.props, idMap) as Readonly<
            Record<string, unknown>
          >,
        },
      ];
    }),
  );
  const rootId = idMap.get(input.rootId);
  if (!rootId)
    throw new PagebldrError("BROKEN_REFERENCE", "Clipboard root is missing.");
  return { ...structuredClone(input), rootId, elements };
}

function remapReferences(
  value: unknown,
  ids: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(value))
    return value.map((child) => remapReferences(child, ids));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "elementId" && typeof child === "string"
        ? (ids.get(child) ?? child)
        : remapReferences(child, ids),
    ]),
  );
}
