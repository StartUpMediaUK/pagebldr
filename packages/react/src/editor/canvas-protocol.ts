import type { PageDocument } from "@pagebldr/core";

export const canvasProtocolVersion = 1 as const;
export const canvasProtocolChannel = "pagebldr.canvas" as const;

export interface CanvasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type CanvasDragSource =
  | { readonly kind: "element"; readonly elementType: string }
  | { readonly kind: "existing"; readonly elementId: string };

interface CanvasEnvelope {
  readonly channel: typeof canvasProtocolChannel;
  readonly version: typeof canvasProtocolVersion;
  readonly canvasId: string;
}

type ShellMessageBody =
  | { readonly type: "document.update"; readonly document: PageDocument }
  | { readonly type: "selection.update"; readonly elementId: string | null }
  | { readonly type: "hover.update"; readonly elementId: string | null }
  | { readonly type: "reveal"; readonly elementId: string }
  | { readonly type: "inline.start"; readonly elementId: string };

export type ShellToCanvasMessage = CanvasEnvelope & ShellMessageBody;

type CanvasMessageBody =
  | { readonly type: "ready" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "selection.change"; readonly elementId: string }
  | { readonly type: "hover.change"; readonly elementId: string | null }
  | {
      readonly type: "geometry.change";
      readonly elementId: string;
      readonly rect: CanvasRect;
    }
  | {
      readonly type: "inline.commit";
      readonly elementId: string;
      readonly property: string;
      readonly value: string;
    }
  | {
      readonly type: "drop.request";
      readonly source: CanvasDragSource;
      readonly targetId: string;
      readonly position: "before" | "inside" | "after";
    }
  | { readonly type: "content.resize"; readonly height: number };

export type CanvasToShellMessage = CanvasEnvelope & CanvasMessageBody;

export function shellMessage(
  canvasId: string,
  message: ShellMessageBody,
): ShellToCanvasMessage {
  return envelope(canvasId, message);
}

export function canvasMessage(
  canvasId: string,
  message: CanvasMessageBody,
): CanvasToShellMessage {
  return envelope(canvasId, message);
}

export function isShellToCanvasMessage(
  value: unknown,
  canvasId: string,
): value is ShellToCanvasMessage {
  if (!isEnvelope(value, canvasId)) return false;
  switch (value.type) {
    case "document.update":
      return isRecord(value.document) && value.document.format === "pagebldr";
    case "selection.update":
    case "hover.update":
      return value.elementId === null || typeof value.elementId === "string";
    case "reveal":
    case "inline.start":
      return typeof value.elementId === "string";
    default:
      return false;
  }
}

export function isCanvasToShellMessage(
  value: unknown,
  canvasId: string,
): value is CanvasToShellMessage {
  if (!isEnvelope(value, canvasId)) return false;
  switch (value.type) {
    case "ready":
      return true;
    case "error":
      return typeof value.message === "string";
    case "selection.change":
      return typeof value.elementId === "string";
    case "hover.change":
      return value.elementId === null || typeof value.elementId === "string";
    case "geometry.change":
      return typeof value.elementId === "string" && isRect(value.rect);
    case "inline.commit":
      return (
        typeof value.elementId === "string" &&
        typeof value.property === "string" &&
        typeof value.value === "string"
      );
    case "drop.request":
      return (
        isDragSource(value.source) &&
        typeof value.targetId === "string" &&
        ["before", "inside", "after"].includes(value.position as string)
      );
    case "content.resize":
      return (
        typeof value.height === "number" &&
        Number.isFinite(value.height) &&
        value.height >= 0
      );
    default:
      return false;
  }
}

function envelope<Message extends { readonly type: string }>(
  canvasId: string,
  message: Message,
): CanvasEnvelope & Message {
  return {
    channel: canvasProtocolChannel,
    version: canvasProtocolVersion,
    canvasId,
    ...message,
  };
}

function isEnvelope(
  value: unknown,
  canvasId: string,
): value is CanvasEnvelope & Record<string, unknown> {
  return (
    isRecord(value) &&
    value.channel === canvasProtocolChannel &&
    value.version === canvasProtocolVersion &&
    value.canvasId === canvasId &&
    typeof value.type === "string"
  );
}

function isRect(value: unknown): value is CanvasRect {
  return (
    isRecord(value) &&
    [value.x, value.y, value.width, value.height].every(Number.isFinite)
  );
}

function isDragSource(value: unknown): value is CanvasDragSource {
  if (!isRecord(value)) return false;
  return value.kind === "element"
    ? typeof value.elementType === "string"
    : value.kind === "existing" && typeof value.elementId === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
