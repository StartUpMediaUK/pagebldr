import { describe, expect, it } from "vitest";
import type { PageDocument } from "@pagebldr/core";

import {
  canvasMessage,
  isCanvasToShellMessage,
  isShellToCanvasMessage,
  shellMessage,
} from "./canvas-protocol.js";

describe("canvas protocol", () => {
  const document = { format: "pagebldr" } as PageDocument;

  it("accepts only versioned messages for the intended canvas", () => {
    const selection = shellMessage("canvas-a", {
      type: "selection.update",
      elementId: "heading",
    });
    expect(isShellToCanvasMessage(selection, "canvas-a")).toBe(true);
    expect(isShellToCanvasMessage(selection, "canvas-b")).toBe(false);
    expect(
      isShellToCanvasMessage({ ...selection, version: 2 }, "canvas-a"),
    ).toBe(false);
  });

  it("accepts every shell-to-canvas message family", () => {
    const messages = [
      shellMessage("canvas-a", { type: "document.update", document }),
      shellMessage("canvas-a", {
        type: "selection.update",
        elementId: null,
      }),
      shellMessage("canvas-a", { type: "hover.update", elementId: "item" }),
      shellMessage("canvas-a", { type: "reveal", elementId: "item" }),
      shellMessage("canvas-a", { type: "inline.start", elementId: "item" }),
    ];
    expect(
      messages.every((message) => isShellToCanvasMessage(message, "canvas-a")),
    ).toBe(true);
    expect(
      isShellToCanvasMessage(
        { ...messages[0], document: { format: "other" } },
        "canvas-a",
      ),
    ).toBe(false);
  });

  it("accepts every canvas-to-shell lifecycle and interaction family", () => {
    const messages = [
      canvasMessage("canvas-a", { type: "ready" }),
      canvasMessage("canvas-a", { type: "error", message: "Unavailable" }),
      canvasMessage("canvas-a", {
        type: "selection.change",
        elementId: "item",
      }),
      canvasMessage("canvas-a", { type: "hover.change", elementId: null }),
      canvasMessage("canvas-a", {
        type: "geometry.change",
        elementId: "item",
        rect: { x: 0, y: 0, width: 10, height: 10 },
      }),
      canvasMessage("canvas-a", {
        type: "inline.commit",
        elementId: "item",
        property: "content",
        value: "Changed",
      }),
      canvasMessage("canvas-a", {
        type: "drop.request",
        source: { kind: "element", elementType: "heading" },
        targetId: "root",
        position: "inside",
      }),
      canvasMessage("canvas-a", { type: "content.resize", height: 900 }),
    ];
    expect(
      messages.every((message) => isCanvasToShellMessage(message, "canvas-a")),
    ).toBe(true);
    expect(
      isCanvasToShellMessage({ ...messages.at(-1), height: -1 }, "canvas-a"),
    ).toBe(false);
  });

  it("validates geometry and inline-edit payloads", () => {
    expect(
      isCanvasToShellMessage(
        canvasMessage("canvas-a", {
          type: "geometry.change",
          elementId: "heading",
          rect: { x: 10, y: 20, width: 300, height: 80 },
        }),
        "canvas-a",
      ),
    ).toBe(true);
    expect(
      isCanvasToShellMessage(
        canvasMessage("canvas-a", {
          type: "inline.commit",
          elementId: "heading",
          property: "content",
          value: "Updated heading",
        }),
        "canvas-a",
      ),
    ).toBe(true);
    expect(
      isCanvasToShellMessage(
        {
          ...canvasMessage("canvas-a", { type: "ready" }),
          type: "geometry.change",
          elementId: "heading",
          rect: { x: 0, y: 0, width: Number.NaN, height: 10 },
        },
        "canvas-a",
      ),
    ).toBe(false);
  });

  it("validates drop requests without exposing DOM details", () => {
    expect(
      isCanvasToShellMessage(
        canvasMessage("canvas-a", {
          type: "drop.request",
          source: { kind: "existing", elementId: "heading" },
          targetId: "section",
          position: "inside",
        }),
        "canvas-a",
      ),
    ).toBe(true);
    expect(
      isCanvasToShellMessage(
        {
          ...canvasMessage("canvas-a", { type: "ready" }),
          type: "drop.request",
          source: { kind: "element", elementType: "heading" },
          targetId: "section",
          position: "invalid",
        },
        "canvas-a",
      ),
    ).toBe(false);
  });
});
