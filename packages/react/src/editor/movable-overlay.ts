"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

export function useMovableOverlay<
  Element extends HTMLElement = HTMLDivElement,
>(options?: { readonly enabled?: (element: HTMLElement) => boolean }) {
  const ref = useRef<Element>(null);
  const [style, setStyle] = useState<CSSProperties | undefined>();

  const beginMove = (event: PointerEvent<Element>) => {
    if ((event.target as HTMLElement).closest("button, input, [role=menu]"))
      return;
    const element = ref.current;
    const boundary = element?.offsetParent as HTMLElement | null;
    if (!element || !boundary || options?.enabled?.(element) === false) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = element.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const move = (moveEvent: globalThis.PointerEvent) => {
      setStyle({
        right: "auto",
        bottom: "auto",
        width: rect.width,
        height: rect.height,
        left: Math.max(
          8,
          Math.min(
            boundaryRect.width - rect.width - 8,
            moveEvent.clientX - boundaryRect.left - offsetX,
          ),
        ),
        top: Math.max(
          8,
          Math.min(
            boundaryRect.height - rect.height - 8,
            moveEvent.clientY - boundaryRect.top - offsetY,
          ),
        ),
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  return {
    beginMove,
    ref,
    reset: () => setStyle(undefined),
    style,
  } as const;
}
