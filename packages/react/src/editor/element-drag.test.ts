import { expect, it } from "vitest";
import {
  createElementDragSession,
  type ElementDragTransfer,
} from "./element-drag.js";
import {
  pagebldrElementDragType,
  pagebldrExistingDragType,
} from "./canvas-placement.js";

function protectedTransfer(): ElementDragTransfer {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    effectAllowed: "none",
    setData: (type, value) => {
      data.set(type, value);
    },
    getData: () => "", // Native dragover enumerates formats, never payloads.
  };
}

it("retains library Element identity while native dragover protects the payload", () => {
  const drag = createElementDragSession();
  const transfer = protectedTransfer();
  drag.start(transfer, { kind: "element", elementType: "heading" });
  expect(transfer.types).toContain(pagebldrElementDragType);
  expect(transfer.effectAllowed).toBe("copy");
  expect(drag.read(transfer)).toEqual({
    kind: "element",
    elementType: "heading",
  });
  drag.end();
  expect(drag.read(transfer)).toBeNull();
});

it("retains Structure move identity in protected-mode canvas dragover", () => {
  const drag = createElementDragSession();
  const transfer = protectedTransfer();
  drag.start(transfer, { kind: "existing", elementId: "heading-1" });
  expect(transfer.types).toContain(pagebldrExistingDragType);
  expect(transfer.effectAllowed).toBe("move");
  expect(drag.read(transfer)).toEqual({
    kind: "existing",
    elementId: "heading-1",
  });
});

it("never leaks an active drag to another editor or an unrelated format", () => {
  const drag = createElementDragSession();
  const other = createElementDragSession();
  const transfer = protectedTransfer();
  drag.start(transfer, { kind: "element", elementType: "heading" });
  expect(other.read(transfer)).toBeNull();
  expect(drag.read(protectedTransfer())).toBeNull();
});

it("uses the readable drop payload rather than a stale cached identity", () => {
  const drag = createElementDragSession();
  const transfer = protectedTransfer();
  drag.start(transfer, { kind: "element", elementType: "heading" });
  transfer.getData = () => "rich-text";
  expect(drag.read(transfer)).toEqual({
    kind: "element",
    elementType: "rich-text",
  });
});
