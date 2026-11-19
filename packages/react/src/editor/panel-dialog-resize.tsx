"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import { GripVerticalIcon } from "lucide-react";
import { Button } from "../components/ui/button.js";

type Size = { readonly width: number; readonly height: number };
const minimum: Size = { width: 80, height: 80 };
const clamp = (value: number) => Math.min(100, Math.max(80, value));

/** Presentation state only; resizing never changes the page or its history. */
export function usePanelDialogResize() {
  const [size, setSize] = useState<Size>(minimum);
  const [active, setActive] = useState(false);
  const instructionsId = useId();
  const drag = useRef<{
    edge: "left" | "right" | "top" | "bottom";
    pointerId: number;
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
    size: Size;
    element: HTMLButtonElement;
  } | null>(null);
  const moved = useRef(false);
  const apply = (next: Size) =>
    setSize((current) => {
      const bounded = { width: clamp(next.width), height: clamp(next.height) };
      return current.width === bounded.width &&
        current.height === bounded.height
        ? current
        : bounded;
    });
  const style: CSSProperties = {
    inset: `${(100 - size.height) / 2}dvh ${(100 - size.width) / 2}dvw`,
    width: `${size.width}dvw`,
    height: `${size.height}dvh`,
  };
  const cancelGesture = () => {
    const start = drag.current;
    if (!start) return false;
    apply(start.size);
    drag.current = null;
    moved.current = true;
    setActive(false);
    if (start.element.hasPointerCapture(start.pointerId))
      start.element.releasePointerCapture(start.pointerId);
    return true;
  };
  const handle = (
    <>
      <span id={instructionsId} className="sr-only">
        Drag to resize. Left and right handles adjust width; top and bottom
        handles adjust height. Use the matching arrow keys; hold Shift for
        larger steps. Home restores 80 percent; End fills the viewport on that
        axis. Click or press Enter to toggle that axis between these sizes.
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        Panel editor size: {Math.round(size.width)} percent wide,{" "}
        {Math.round(size.height)} percent tall.
      </span>
      {(["left", "right", "top", "bottom"] as const).map((edge) => {
        const axis = edge === "left" || edge === "right" ? "width" : "height";
        const direction = edge === "left" || edge === "top" ? -1 : 1;
        return (
          <Button
            key={edge}
            data-edge={edge}
            type="button"
            variant="ghost"
            size="icon-xs"
            className="pagebldr-panel-resize-handle"
            aria-label={`Resize panel editor ${axis} from ${edge}`}
            aria-describedby={instructionsId}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
            title={`Resize panel editor ${axis} from ${edge}`}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              event.preventDefault();
              event.stopPropagation();
              const view = event.currentTarget.ownerDocument.defaultView!;
              drag.current = {
                edge,
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                viewportWidth: view.innerWidth,
                viewportHeight: view.innerHeight,
                size,
                element: event.currentTarget,
              };
              moved.current = false;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              setActive(true);
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (
                !start ||
                start.pointerId !== event.pointerId ||
                start.edge !== edge
              )
                return;
              const x = event.clientX - start.x;
              const y = event.clientY - start.y;
              if (Math.abs(x) + Math.abs(y) > 3) moved.current = true;
              // Both edges move equally because the dialog remains centered.
              apply({
                ...start.size,
                [axis]:
                  start.size[axis] +
                  direction *
                    (axis === "width"
                      ? (x * 200) / start.viewportWidth
                      : (y * 200) / start.viewportHeight),
              });
            }}
            onPointerUp={(event) => {
              if (drag.current?.pointerId !== event.pointerId) return;
              drag.current = null;
              setActive(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              if (drag.current?.pointerId !== event.pointerId) return;
              cancelGesture();
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setActive(false);
            }}
            onClick={(event) => {
              if (event.detail !== 0 && moved.current) {
                moved.current = false;
                return;
              }
              apply({ ...size, [axis]: size[axis] === 100 ? 80 : 100 });
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && drag.current) {
                event.preventDefault();
                event.stopPropagation();
                cancelGesture();
                return;
              }
              const step = event.shiftKey ? 5 : 2;
              const delta =
                axis === "width"
                  ? event.key === "ArrowRight"
                    ? step
                    : event.key === "ArrowLeft"
                      ? -step
                      : null
                  : event.key === "ArrowDown"
                    ? step
                    : event.key === "ArrowUp"
                      ? -step
                      : null;
              const value =
                event.key === "Home"
                  ? 80
                  : event.key === "End"
                    ? 100
                    : delta === null
                      ? null
                      : size[axis] + direction * delta;
              const next = value === null ? null : { ...size, [axis]: value };
              if (!next) return;
              event.preventDefault();
              event.stopPropagation();
              apply(next);
            }}
          >
            <GripVerticalIcon aria-hidden="true" />
          </Button>
        );
      })}
    </>
  );
  return { active, style, handle, cancelGesture };
}
