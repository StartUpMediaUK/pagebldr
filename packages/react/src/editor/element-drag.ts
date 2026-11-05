import type { CanvasDragSource } from "./canvas-protocol.js";
import {
  pagebldrElementDragType,
  pagebldrExistingDragType,
} from "./canvas-placement.js";

type ElementDragSource = Exclude<CanvasDragSource, { kind: "block" }>;
export type ElementDragTransfer = Pick<
  DataTransfer,
  "types" | "getData" | "setData" | "effectAllowed"
>;

/** Private, per-editor native Element drag lifecycle. */
export function createElementDragSession() {
  let active: ElementDragSource | null = null;
  return {
    start(transfer: ElementDragTransfer, source: ElementDragSource): void {
      active = source;
      transfer.effectAllowed = source.kind === "element" ? "copy" : "move";
      transfer.setData(
        source.kind === "element"
          ? pagebldrElementDragType
          : pagebldrExistingDragType,
        source.kind === "element" ? source.elementType : source.elementId,
      );
    },
    read(transfer: ElementDragTransfer): ElementDragSource | null {
      if (transfer.types.includes(pagebldrElementDragType)) {
        const elementType = transfer.getData(pagebldrElementDragType);
        return elementType
          ? { kind: "element", elementType }
          : active?.kind === "element"
            ? active
            : null;
      }
      if (transfer.types.includes(pagebldrExistingDragType)) {
        const elementId = transfer.getData(pagebldrExistingDragType);
        return elementId
          ? { kind: "existing", elementId }
          : active?.kind === "existing"
            ? active
            : null;
      }
      return null;
    },
    end(): void {
      active = null;
    },
  };
}
