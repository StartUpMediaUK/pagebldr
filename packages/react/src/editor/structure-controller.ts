import type { Breakpoint, PageDocument, PageElement } from "@pagebldr/core";

export interface StructureRow {
  readonly id: string;
  readonly depth: number;
  readonly hasChildren: boolean;
}

export function visibleStructureRows(
  document: PageDocument,
  expanded: ReadonlySet<string>,
): readonly StructureRow[] {
  const rows: StructureRow[] = [];
  const visit = (id: string, depth: number) => {
    const element = document.elements[id];
    if (!element) return;
    rows.push({ id, depth, hasChildren: element.children.length > 0 });
    if (expanded.has(id))
      for (const childId of element.children) visit(childId, depth + 1);
  };
  visit(document.rootId, 0);
  return rows;
}

export function defaultExpandedStructureIds(
  document: PageDocument,
): ReadonlySet<string> {
  const expanded = new Set([document.rootId]);
  for (const childId of document.elements[document.rootId]?.children ?? [])
    if (document.elements[childId]?.children.length) expanded.add(childId);
  return expanded;
}

export function responsiveHiddenBreakpoints(
  element: PageElement,
): readonly Breakpoint[] {
  return (["desktop", "tablet", "mobile"] as const).filter(
    (breakpoint) => element.styles[breakpoint]?.normal?.display === "none",
  );
}

export function hasBrokenAnchorReference(
  element: PageElement,
  document: PageDocument,
): boolean {
  return containsBrokenAnchor(element.props, document);
}

function containsBrokenAnchor(value: unknown, document: PageDocument): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value))
    return value.some((item) => containsBrokenAnchor(item, document));
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.type === "anchor" &&
    typeof record.elementId === "string" &&
    !document.elements[record.elementId]
  )
    return true;
  return Object.values(record).some((item) =>
    containsBrokenAnchor(item, document),
  );
}

export type StructureKeyResult =
  | { readonly type: "select"; readonly elementId: string }
  | { readonly type: "expand"; readonly elementId: string }
  | { readonly type: "collapse"; readonly elementId: string }
  | null;

export function structureKeyAction(input: {
  readonly document: PageDocument;
  readonly expanded: ReadonlySet<string>;
  readonly selectedId: string;
  readonly key: "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp";
}): StructureKeyResult {
  const rows = visibleStructureRows(input.document, input.expanded);
  const rowIndex = rows.findIndex((row) => row.id === input.selectedId);
  if (rowIndex < 0) return null;
  const row = rows[rowIndex]!;
  if (input.key === "ArrowUp" && rowIndex > 0)
    return { type: "select", elementId: rows[rowIndex - 1]!.id };
  if (input.key === "ArrowDown" && rowIndex < rows.length - 1)
    return { type: "select", elementId: rows[rowIndex + 1]!.id };
  if (input.key === "ArrowRight") {
    if (row.hasChildren && !input.expanded.has(row.id))
      return { type: "expand", elementId: row.id };
    const firstChild = input.document.elements[row.id]?.children[0];
    return firstChild ? { type: "select", elementId: firstChild } : null;
  }
  if (input.key === "ArrowLeft") {
    if (row.hasChildren && input.expanded.has(row.id))
      return { type: "collapse", elementId: row.id };
    const parentId = parentOf(input.document, row.id);
    return parentId ? { type: "select", elementId: parentId } : null;
  }
  return null;
}

function parentOf(document: PageDocument, elementId: string): string | null {
  for (const element of Object.values(document.elements))
    if (element.children.includes(elementId)) return element.id;
  return null;
}
