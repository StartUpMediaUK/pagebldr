"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Separator } from "../components/ui/separator.js";

const minimumWidth = 280;
const maximumWidth = 430;
const clamp = (width: number) =>
  Math.min(maximumWidth, Math.max(minimumWidth, width));

/** Presentation only: resizing never dispatches a Document command. */
export function WorkspacePanels({
  compact,
  panel,
  children,
}: {
  readonly compact: boolean;
  readonly panel: ReactNode;
  readonly children: ReactNode;
}) {
  const [width, setWidth] = useState(340);
  const id = useId();
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(
    null,
  );
  useEffect(() => {
    const cancel = () => {
      drag.current = null;
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  return (
    <>
      {panel ? (
        <>
          <div
            id={id}
            className="h-full shrink-0"
            style={compact ? { display: "contents" } : { width }}
          >
            {panel}
          </div>
          {!compact ? (
            <div
              role="separator"
              aria-label="Resize editor panel"
              aria-controls={id}
              aria-orientation="vertical"
              aria-valuemin={minimumWidth}
              aria-valuemax={maximumWidth}
              aria-valuenow={width}
              aria-valuetext={`${Math.round(width)} pixels`}
              tabIndex={0}
              className="relative z-10 shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{
                width: 7,
                marginInline: -3,
                cursor: "col-resize",
                touchAction: "none",
              }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 50 : 10;
                switch (event.key) {
                  case "Home":
                    setWidth(minimumWidth);
                    break;
                  case "End":
                    setWidth(maximumWidth);
                    break;
                  case "ArrowLeft":
                    setWidth((width) => clamp(width - step));
                    break;
                  case "ArrowRight":
                    setWidth((width) => clamp(width + step));
                    break;
                  default:
                    return;
                }
                event.preventDefault();
              }}
              onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary) return;
                event.preventDefault();
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  width,
                };
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (active?.pointerId === event.pointerId)
                  setWidth(clamp(active.width + event.clientX - active.x));
              }}
              onPointerUp={(event) => {
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            >
              <Separator orientation="vertical" className="mx-auto" />
            </div>
          ) : null}
        </>
      ) : null}
      {children}
    </>
  );
}
