import { expect, it } from "vitest";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import {
  startBlockDrag,
  endBlockDrag,
  readBlockDrag,
  pagebldrBlockDragType,
} from "./block-drag.js";
import { canvasMessage, isCanvasToShellMessage } from "./canvas-protocol.js";

it("retains a validated native Block through protected-mode dragover and the canvas protocol", () => {
  const builder = createPagebldr({
    namespace: "block-drag",
    elements: standardElements,
    styleCapabilities: standardStyleCapabilities,
  });
  const document = builder.documents.create({ id: "page" });
  const clipboard = builder.editor.clipboard.copy(document, document.rootId);
  const data = new Map<string, string>();
  const transfer = {
    types: [pagebldrBlockDragType],
    effectAllowed: "none",
    setData: (type: string, value: string) => data.set(type, value),
    getData: () => "",
  } as unknown as DataTransfer;
  startBlockDrag(transfer, clipboard);
  expect(readBlockDrag(transfer)).toBe(clipboard);
  expect(data.get(pagebldrBlockDragType)).toContain("pagebldr-clipboard");
  const message = canvasMessage("canvas", {
    type: "drop.request",
    source: { kind: "block", elementType: "container", clipboard },
    targetId: document.rootId,
    position: "inside",
  });
  expect(isCanvasToShellMessage(message, "canvas")).toBe(true);
  expect(
    isCanvasToShellMessage(
      {
        ...message,
        source: {
          kind: "block",
          elementType: "container",
          clipboard: { format: "other" },
        },
      },
      "canvas",
    ),
  ).toBe(false);
  endBlockDrag();
  expect(readBlockDrag(transfer)).toBeNull();
});
