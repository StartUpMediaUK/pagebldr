import type {
  ElementDefinition,
  PagebldrClipboard,
  PageDocument,
  PageElement,
} from "@pagebldr/core";

export const pagebldrElementDragType = "application/x-pagebldr-element";
export const pagebldrExistingDragType = "application/x-pagebldr-existing";

export type CanvasPlacementPosition = "before" | "inside" | "after";

export interface CanvasPlacement {
  readonly targetId: string;
  readonly position: CanvasPlacementPosition;
  readonly parentId: string;
  readonly index: number;
}

export type KeyboardMoveDirection = "up" | "down" | "in" | "out";

export function createElementClipboard(
  definition: ElementDefinition,
): PagebldrClipboard {
  const temporaryId = `new-${definition.type}`;
  const element: PageElement = {
    id: temporaryId,
    type: definition.type,
    elementVersion: definition.version,
    name: definition.label,
    props: definition.defaults() as Readonly<Record<string, unknown>>,
    children: [],
    classIds: [],
    styles: {},
    locked: false,
    hidden: false,
  };
  return {
    format: "pagebldr-clipboard",
    schemaVersion: 1,
    rootId: temporaryId,
    elements: { [temporaryId]: element },
    classes: {},
    classOrder: [],
    variables: {},
    variableOrder: [],
  };
}

export function resolveCanvasPlacement(input: {
  readonly document: PageDocument;
  readonly definitions: ReadonlyMap<string, ElementDefinition>;
  readonly elementType: string;
  readonly targetId: string;
  readonly position: CanvasPlacementPosition;
  readonly movingId?: string;
}): CanvasPlacement | null {
  const target = input.document.elements[input.targetId];
  if (!target) return null;
  const moving = input.movingId
    ? input.document.elements[input.movingId]
    : null;
  if (
    input.movingId &&
    (!moving ||
      moving.locked ||
      input.movingId === input.document.rootId ||
      input.movingId === input.targetId ||
      descendants(input.document, input.movingId).has(input.targetId))
  )
    return null;

  if (input.position === "inside") {
    if (
      target.locked ||
      !canContain(
        input.definitions.get(target.type),
        target,
        input.elementType,
        input.movingId,
      )
    )
      return null;
    const children = target.children.filter((id) => id !== input.movingId);
    return {
      targetId: target.id,
      position: "inside",
      parentId: target.id,
      index: children.length,
    };
  }

  const parent = findParent(input.document, target.id);
  if (
    !parent ||
    parent.locked ||
    !canContain(
      input.definitions.get(parent.type),
      parent,
      input.elementType,
      input.movingId,
    )
  )
    return null;
  const children = parent.children.filter((id) => id !== input.movingId);
  const targetIndex = children.indexOf(target.id);
  if (targetIndex < 0) return null;
  return {
    targetId: target.id,
    position: input.position,
    parentId: parent.id,
    index: targetIndex + (input.position === "after" ? 1 : 0),
  };
}

export function resolveClickInsertion(input: {
  readonly document: PageDocument;
  readonly definitions: ReadonlyMap<string, ElementDefinition>;
  readonly elementType: string;
  readonly selectedId: string | null;
}): CanvasPlacement | null {
  const targetId = input.selectedId ?? input.document.rootId;
  return (
    resolveCanvasPlacement({ ...input, targetId, position: "inside" }) ??
    resolveCanvasPlacement({ ...input, targetId, position: "after" }) ??
    resolveCanvasPlacement({
      ...input,
      targetId: input.document.rootId,
      position: "inside",
    })
  );
}

export function resolveKeyboardMove(input: {
  readonly document: PageDocument;
  readonly definitions: ReadonlyMap<string, ElementDefinition>;
  readonly elementId: string;
  readonly direction: KeyboardMoveDirection;
}): CanvasPlacement | null {
  const element = input.document.elements[input.elementId];
  const parent = element ? findParent(input.document, element.id) : undefined;
  if (!element || !parent || element.locked) return null;
  const index = parent.children.indexOf(element.id);

  if (input.direction === "up" && index > 0)
    return resolveCanvasPlacement({
      ...input,
      elementType: element.type,
      movingId: element.id,
      targetId: parent.children[index - 1]!,
      position: "before",
    });
  if (input.direction === "down" && index < parent.children.length - 1)
    return resolveCanvasPlacement({
      ...input,
      elementType: element.type,
      movingId: element.id,
      targetId: parent.children[index + 1]!,
      position: "after",
    });
  if (input.direction === "in" && index > 0)
    return resolveCanvasPlacement({
      ...input,
      elementType: element.type,
      movingId: element.id,
      targetId: parent.children[index - 1]!,
      position: "inside",
    });
  if (input.direction === "out" && parent.id !== input.document.rootId)
    return resolveCanvasPlacement({
      ...input,
      elementType: element.type,
      movingId: element.id,
      targetId: parent.id,
      position: "after",
    });
  return null;
}

function canContain(
  definition: ElementDefinition | undefined,
  parent: PageElement,
  elementType: string,
  movingId?: string,
) {
  const policy = definition?.childPolicy ?? { kind: "any" as const };
  if (policy.kind === "none") return false;
  const childCount = parent.children.filter((id) => id !== movingId).length;
  if (policy.max !== undefined && childCount >= policy.max) return false;
  return policy.kind === "any" || policy.types.includes(elementType);
}

function findParent(document: PageDocument, childId: string) {
  return Object.values(document.elements).find((element) =>
    element.children.includes(childId),
  );
}

function descendants(document: PageDocument, elementId: string) {
  const result = new Set<string>();
  const visit = (id: string) => {
    for (const child of document.elements[id]?.children ?? []) {
      result.add(child);
      visit(child);
    }
  };
  visit(elementId);
  return result;
}
