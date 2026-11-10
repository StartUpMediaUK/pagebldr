"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type DragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  LocateFixedIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  PencilIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";

import type { Pagebldr, PageDocument, ResourceReference } from "@pagebldr/core";

import { ScrollArea } from "../components/ui/scroll-area.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../components/ui/empty.js";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import { PagebldrRenderer } from "../renderer.js";
import { PagebldrRuntimeInteractions } from "../runtime-interactions.js";
import {
  canvasBreakpointRange,
  canvasViewportHeight,
  canvasViewportWidth,
  fitCanvasZoom,
  stepCanvasZoom,
  wheelCanvasZoom,
} from "./canvas-controller.js";
import { useCanvasDimensions } from "./canvas-dimensions-context.js";
import {
  createElementClipboard,
  resolveCanvasPlacement,
  resolveKeyboardMove,
  type KeyboardMoveDirection,
  type CanvasPlacement,
  type CanvasPlacementPosition,
} from "./canvas-placement.js";
import {
  canvasMessage,
  isCanvasToShellMessage,
  isShellToCanvasMessage,
  shellMessage,
  type CanvasRect,
  type CanvasDragSource,
} from "./canvas-protocol.js";
import { usePagebldrEditor, useElementDragSession } from "./context.js";
import { readBlockDrag } from "./block-drag.js";

type CanvasStatus = "loading" | "ready" | "error";

export function IsolatedCanvas({
  children,
  compact = false,
  onElementContextMenu,
}: {
  readonly children?: ReactNode;
  readonly compact?: boolean;
  readonly onElementContextMenu?: (
    elementId: string,
    x: number,
    y: number,
  ) => void;
}) {
  const editor = usePagebldrEditor();
  const editorRef = useRef(editor);
  const generatedId = useId();
  const canvasId = `canvas-${generatedId.replaceAll(":", "")}`;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [status, setStatus] = useState<CanvasStatus>("loading");
  useEffect(() => {
    const documents = [
      window.document,
      ...(frameDocument ? [frameDocument] : []),
    ];
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const scrolling = (event: Event) => {
      const target = event.target;
      const element =
        target && "nodeType" in target && target.nodeType === 1
          ? (target as Element)
          : frameDocument && target === frameDocument
            ? frameDocument.documentElement
            : null;
      if (!element) return;
      element.setAttribute("data-pagebldr-scrolling", "");
      clearTimeout(timers.get(element));
      timers.set(
        element,
        setTimeout(() => {
          element.removeAttribute("data-pagebldr-scrolling");
          timers.delete(element);
        }, 700),
      );
    };
    frameDocument?.documentElement.setAttribute(
      "data-pagebldr-canvas-scroll",
      "",
    );
    documents.forEach((document) =>
      document.addEventListener("scroll", scrolling, true),
    );
    return () => {
      documents.forEach((document) =>
        document.removeEventListener("scroll", scrolling, true),
      );
      timers.forEach((timer, element) => {
        clearTimeout(timer);
        element.removeAttribute("data-pagebldr-scrolling");
      });
      frameDocument?.documentElement.removeAttribute(
        "data-pagebldr-canvas-scroll",
      );
    };
  }, [frameDocument]);

  const [error, setError] = useState("");
  const [contentHeight, setContentHeight] = useState(900);
  const [workspaceSize, setWorkspaceSize] = useState({
    width: 900,
    height: 700,
  });
  const [zoom, setZoom] = useState(1);
  const [fitEnabled, setFitEnabled] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(zoom);
  const [geometry, setGeometry] = useState<{
    readonly elementId: string;
    readonly rect: CanvasRect;
  } | null>(null);
  const revealTarget = useRef<string | null>(null);
  const previousSelection = useRef(editor.selectedId);
  editorRef.current = editor;
  const contextMenuRef = useRef(onElementContextMenu);
  contextMenuRef.current = onElementContextMenu;
  zoomRef.current = zoom;

  const send = useCallback(
    (message: Parameters<typeof shellMessage>[1]) => {
      frameRef.current?.contentWindow?.postMessage(
        shellMessage(canvasId, message),
        "*",
      );
    },
    [canvasId],
  );

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const update = () =>
      setWorkspaceSize({
        width: workspace.clientWidth,
        height: workspace.clientHeight,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frameRef.current?.contentWindow ||
        !isCanvasToShellMessage(event.data, canvasId)
      )
        return;
      const message = event.data;
      const current = editorRef.current;
      switch (message.type) {
        case "element.context": {
          if (
            current.mode !== "edit" ||
            current.previewing ||
            !current.document.elements[message.elementId]
          )
            break;
          current.select(message.elementId);
          const frame = frameRef.current?.getBoundingClientRect();
          if (frame)
            contextMenuRef.current?.(
              message.elementId,
              frame.left + message.x * zoomRef.current,
              frame.top + message.y * zoomRef.current,
            );
          break;
        }
        case "element.delete": {
          const element = current.document.elements[message.elementId];
          if (
            current.mode === "edit" &&
            !current.previewing &&
            element &&
            !element.locked &&
            message.elementId !== current.document.rootId
          ) {
            current.dispatch({ type: "remove", elementId: message.elementId });
            current.select(null);
          }
          break;
        }
        case "ready":
          setStatus("ready");
          setError("");
          break;
        case "error":
          setStatus("error");
          setError(message.message);
          break;
        case "selection.change":
          current.select(message.elementId);
          break;
        case "history.request":
          if (current.mode === "edit" && !current.previewing)
            current[message.action]();
          break;
        case "hover.change":
          current.hover(message.elementId);
          break;
        case "geometry.change":
          setGeometry({ elementId: message.elementId, rect: message.rect });
          if (revealTarget.current === message.elementId) {
            revealTarget.current = null;
            revealRect(
              workspaceRef.current,
              frameRef.current,
              message.rect,
              zoomRef.current,
            );
          }
          break;
        case "content.resize":
          setContentHeight(Math.max(320, Math.ceil(message.height)));
          break;
        case "inline.commit": {
          const element = current.document.elements[message.elementId];
          const inlineEditing = element
            ? current.builder.elements.get(element.type)?.inlineEditing
            : null;
          if (
            !element ||
            !inlineEditing ||
            inlineEditing.property !== message.property
          )
            break;
          current.dispatch(
            {
              type: "update-props",
              elementId: element.id,
              patch: inlineEditing.update(message.value, element.props),
            },
            `inline:${element.id}:${message.property}`,
          );
          break;
        }
        case "drop.request": {
          if (current.mode !== "edit" || current.previewing) break;
          const moving =
            message.source.kind === "existing"
              ? current.document.elements[message.source.elementId]
              : null;
          const elementType =
            message.source.kind !== "existing"
              ? message.source.elementType
              : moving?.type;
          if (!elementType) break;
          const placement = resolveCanvasPlacement({
            document: current.document,
            definitions: current.builder.elements,
            elementType,
            targetId: message.targetId,
            position: message.position,
            ...(moving ? { movingId: moving.id } : {}),
          });
          if (!placement) break;
          if (message.source.kind === "block") {
            const source = message.source.clipboard;
            const document = current.document;
            void (async () => {
              const adapted =
                (await current.librarySource?.adaptBlockReferences?.(
                  source,
                  new AbortController().signal,
                )) ?? source;
              const latest = editorRef.current;
              if (
                latest.document !== document ||
                latest.mode !== "edit" ||
                latest.previewing
              )
                throw new Error(
                  "Document changed during Block adaptation. Drop the Block again.",
                );
              const clipboard = latest.builder.editor.library.prepareBlock(
                adapted,
                document,
              );
              latest.dispatch({
                type: "insert",
                parentId: placement.parentId,
                index: placement.index,
                clipboard,
              });
              latest.select(clipboard.rootId);
            })().catch((failure: unknown) =>
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Block insertion failed.",
              ),
            );
          } else if (message.source.kind === "existing")
            current.dispatch({
              type: "move",
              elementId: message.source.elementId,
              parentId: placement.parentId,
              index: placement.index,
            });
          else {
            const definition = current.builder.elements.get(elementType);
            if (!definition) break;
            current.dispatch({
              type: "insert",
              parentId: placement.parentId,
              index: placement.index,
              clipboard: createElementClipboard(definition),
            });
          }
          break;
        }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [canvasId]);

  useEffect(() => {
    if (status === "ready")
      send({ type: "document.update", document: editor.document });
  }, [editor.document, send, status]);

  useEffect(() => {
    const selectionChanged = previousSelection.current !== editor.selectedId;
    if (selectionChanged) {
      previousSelection.current = editor.selectedId;
      revealTarget.current = editor.selectedId;
    }
    if (status === "ready") {
      send({ type: "selection.update", elementId: editor.selectedId });
      if (selectionChanged && editor.selectedId)
        send({ type: "reveal", elementId: editor.selectedId });
    }
  }, [editor.selectedId, send, status]);

  useEffect(() => {
    if (status === "ready")
      send({ type: "hover.update", elementId: editor.hoveredId });
  }, [editor.hoveredId, send, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== "Enter" ||
        !editor.selectedId ||
        isInteractiveTarget(event.target)
      )
        return;
      const element = editor.document.elements[editor.selectedId];
      if (
        element &&
        !element.locked &&
        editor.builder.elements.get(element.type)?.inlineEditing
      ) {
        event.preventDefault();
        send({ type: "inline.start", elementId: element.id });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, send]);

  const canvasWidth = canvasViewportWidth(
    editor.viewport,
    editor.document.settings,
    Math.max(320, workspaceSize.width - 32),
  );
  const scaledWidth = canvasWidth * zoom;
  const frameHeight =
    editor.viewport === "desktop" ? (canvasWidth * 9) / 16 : contentHeight;
  const scaledHeight = frameHeight * zoom;
  const fitZoom = fitCanvasZoom({
    canvasWidth,
    availableWidth: workspaceSize.width,
  });
  const visibleCanvasHeight =
    editor.viewport === "desktop"
      ? frameHeight
      : canvasViewportHeight(workspaceSize.height, zoom);
  const wasCompact = useRef(false);
  useEffect(() => {
    if (compact && !wasCompact.current) setFitEnabled(true);
    wasCompact.current = compact;
  }, [compact]);
  const revealSelection = useCallback(() => {
    if (editor.selectedId) {
      revealTarget.current = editor.selectedId;
      send({ type: "reveal", elementId: editor.selectedId });
    }
  }, [editor.selectedId, send]);
  useEffect(() => {
    const root = workspaceRef.current?.closest("[data-pagebldr-editor]");
    root?.addEventListener("pagebldr:reveal-selection", revealSelection);
    return () =>
      root?.removeEventListener("pagebldr:reveal-selection", revealSelection);
  }, [revealSelection]);
  const enableFit = () => {
    setFitEnabled(true);
    setZoom(fitZoom);
  };
  const toggleFit = () => {
    if (fitEnabled) setFitEnabled(false);
    else enableFit();
  };
  const changeZoom = (direction: -1 | 1) => {
    setFitEnabled(false);
    setZoom((current) => stepCanvasZoom(current, direction));
  };

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    let held = false;
    let drag: {
      id: number;
      x: number;
      y: number;
      left: number;
      top: number;
    } | null = null;
    const finish = () => {
      const id = drag?.id;
      drag = null;
      setPanning(false);
      if (id !== undefined && workspace.hasPointerCapture(id))
        workspace.releasePointerCapture(id);
    };
    const reset = () => {
      held = false;
      setSpaceHeld(false);
      finish();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isInteractiveTarget(event.target)
      )
        return;
      if (
        !isDomElement(event.target) ||
        (!workspace.contains(event.target) &&
          event.target.ownerDocument !== frameDocument)
      )
        return;
      if (
        workspace.scrollWidth <= workspace.clientWidth &&
        workspace.scrollHeight <= workspace.clientHeight
      )
        return;
      event.preventDefault();
      held = true;
      setSpaceHeld(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") reset();
    };
    const begin = (event: PointerEvent) => {
      if (!held || event.button !== 0 || isInteractiveTarget(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: workspace.scrollLeft,
        top: workspace.scrollTop,
      };
      workspace.setPointerCapture(event.pointerId);
      setPanning(true);
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault();
      workspace.scrollLeft = drag.left + drag.x - event.clientX;
      workspace.scrollTop = drag.top + drag.y - event.clientY;
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId === drag?.id) finish();
    };
    const wheel = (event: WheelEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented ||
        isInteractiveTarget(event.target) ||
        !Number.isFinite(event.deltaY) ||
        event.deltaY === 0
      )
        return;
      event.preventDefault();
      setFitEnabled(false);
      setZoom((current) => wheelCanvasZoom(current, event.deltaY));
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", reset);
    frameDocument?.addEventListener("keydown", keyDown, true);
    frameDocument?.addEventListener("keyup", keyUp, true);
    workspace.addEventListener("pointerdown", begin, true);
    workspace.addEventListener("pointermove", move);
    workspace.addEventListener("pointerup", end);
    workspace.addEventListener("pointercancel", end);
    workspace.addEventListener("lostpointercapture", finish);
    workspace.addEventListener("wheel", wheel, { passive: false });
    frameDocument?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      reset();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", reset);
      frameDocument?.removeEventListener("keydown", keyDown, true);
      frameDocument?.removeEventListener("keyup", keyUp, true);
      workspace.removeEventListener("pointerdown", begin, true);
      workspace.removeEventListener("pointermove", move);
      workspace.removeEventListener("pointerup", end);
      workspace.removeEventListener("pointercancel", end);
      workspace.removeEventListener("lostpointercapture", finish);
      workspace.removeEventListener("wheel", wheel);
      frameDocument?.removeEventListener("wheel", wheel);
    };
  }, [frameDocument]);

  useEffect(() => {
    if (fitEnabled) setZoom(fitZoom);
  }, [fitEnabled, fitZoom]);
  useEffect(() => {
    if (editor.canvasFitVersion > 0) setFitEnabled(true);
  }, [editor.canvasFitVersion]);

  const loadFrame = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document) {
      setStatus("error");
      setError("The isolated canvas document could not be opened.");
      return;
    }
    installPackageStyles(window.document, document);
    setFrameDocument(document);
  }, []);

  useEffect(() => {
    // An SSR frame can finish loading before React attaches its load listener.
    const document = frameRef.current?.contentDocument;
    if (
      document?.readyState === "complete" &&
      document.getElementById("pagebldr-canvas-root")
    )
      loadFrame();
  }, [loadFrame]);

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={workspaceRef}
        className="relative h-full overflow-auto bg-muted p-4 @max-[1024px]:p-8"
        onClick={(event) => {
          if (event.target === event.currentTarget && !spaceHeld)
            editor.select(null);
        }}
        data-pagebldr-canvas-workspace
        data-canvas-status={status}
        tabIndex={0}
        role="region"
        aria-label="Canvas workspace"
        aria-describedby={`${canvasId}-navigation`}
        style={{
          cursor: panning ? "grabbing" : spaceHeld ? "grab" : undefined,
          userSelect: spaceHeld ? "none" : undefined,
        }}
      >
        <p id={`${canvasId}-navigation`} className="sr-only">
          Hold Space and drag to pan. Alt and mouse wheel zooms. Arrow keys
          scroll the focused workspace; zoom controls also work with the
          keyboard.
        </p>
        {children ? (
          <div className="pointer-events-none absolute inset-0">{children}</div>
        ) : null}
        <CanvasViewportIndicator
          fixedDesktop={editor.viewport === "desktop"}
          height={visibleCanvasHeight}
          settings={editor.document.settings}
          width={canvasWidth}
        />
        <div
          className="relative mx-auto origin-top overflow-visible transition-[width,height]"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          <iframe
            ref={frameRef}
            title="Page canvas"
            sandbox="allow-same-origin allow-scripts"
            srcDoc={frameHtml}
            onLoad={loadFrame}
            className="absolute left-0 top-0 block border-0 bg-background shadow-lg"
            style={{
              width: canvasWidth,
              height: frameHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              pointerEvents: spaceHeld ? "none" : undefined,
            }}
          />
        </div>
        {status === "loading" ? (
          <Badge
            className="absolute left-1/2 top-6 -translate-x-1/2"
            variant="secondary"
          >
            Preparing canvas…
          </Badge>
        ) : null}
        {error && status !== "error" ? (
          <p
            role="alert"
            className="absolute top-2 left-2 z-20 rounded-md bg-background p-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {status === "error" ? (
          <div className="absolute inset-4 flex items-center justify-center rounded-md bg-background">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Canvas unavailable</EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : null}
      </div>
      <CanvasZoomControls
        fitEnabled={fitEnabled}
        zoom={zoom}
        onDecrease={() => changeZoom(-1)}
        onIncrease={() => changeZoom(1)}
        onFit={enableFit}
        onToggleFit={toggleFit}
        onReveal={() => {
          if (editor.selectedId) {
            revealTarget.current = editor.selectedId;
            send({ type: "reveal", elementId: editor.selectedId });
          }
        }}
      />
      <span className="sr-only" aria-live="polite">
        {geometry && editor.selected
          ? `${editor.selected.name} selected at ${Math.round(geometry.rect.x)}, ${Math.round(geometry.rect.y)}`
          : ""}
      </span>
      {frameDocument
        ? createPortal(
            <CanvasRuntime
              builder={editor.builder}
              canvasId={canvasId}
              zoom={zoom}
              workspace={workspaceRef.current}
              frameWindow={frameDocument.defaultView!}
              mode={
                editor.mode === "edit" && !editor.previewing
                  ? "edit"
                  : "preview"
              }
              forcedStyleState={
                editor.styleState === "normal" || !editor.selectedId
                  ? null
                  : {
                      elementId: editor.selectedId,
                      state: editor.styleState,
                    }
              }
              resolveApplicationDestination={
                editor.resolveApplicationDestination
              }
            />,
            frameDocument.getElementById("pagebldr-canvas-root")!,
          )
        : null}
    </div>
  );
}

function CanvasRuntime({
  builder,
  canvasId,
  frameWindow,
  mode,
  zoom,
  workspace,
  forcedStyleState,
  resolveApplicationDestination,
}: {
  readonly builder: Pagebldr;
  readonly canvasId: string;
  readonly frameWindow: Window;
  readonly mode: "edit" | "preview";
  readonly zoom: number;
  readonly workspace: HTMLDivElement | null;
  readonly forcedStyleState: {
    readonly elementId: string;
    readonly state: "hover" | "focusVisible";
  } | null;
  readonly resolveApplicationDestination:
    ((reference: ResourceReference) => string | null) | undefined;
}) {
  const elementDrag = useElementDragSession();
  const [document, setDocument] = useState<PageDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rendererEpoch, setRendererEpoch] = useState(0);

  const [dropTarget, setDropTarget] = useState<
    (CanvasPlacement & { readonly rect: DOMRect }) | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerMove = useRef<{
    readonly pointerId: number;
    readonly button: HTMLButtonElement;
    readonly elementId: string;
    readonly x: number;
    readonly y: number;
    dragging: boolean;
  } | null>(null);
  const ignoreHandleClick = useRef(false);
  const cancelPointerMove = useCallback(() => {
    const active = pointerMove.current;
    pointerMove.current = null;
    if (active?.button.hasPointerCapture(active.pointerId))
      active.button.releasePointerCapture(active.pointerId);
    setDropTarget(null);
  }, []);
  useEffect(() => {
    cancelPointerMove();
    return cancelPointerMove;
  }, [cancelPointerMove, document, mode]);
  const activeEdit = useRef<{
    readonly element: HTMLElement;
    readonly originalMarkup: string;
    readonly property: string;
  } | null>(null);

  const post = useCallback(
    (message: Parameters<typeof canvasMessage>[1]) => {
      const event = frameWindow.document.createEvent("CustomEvent");
      event.initCustomEvent(
        canvasToShellEvent,
        false,
        false,
        canvasMessage(canvasId, message),
      );
      frameWindow.document.dispatchEvent(event);
    },
    [canvasId, frameWindow],
  );

  useEffect(() => {
    const removeSelected = (event: globalThis.KeyboardEvent) => {
      if (
        mode !== "edit" ||
        !selectedId ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.defaultPrevented ||
        closestElement(
          event.target,
          "input, textarea, select, [contenteditable=true], [role=textbox]",
        )
      )
        return;
      event.preventDefault();
      post({ type: "element.delete", elementId: selectedId });
    };
    frameWindow.document.addEventListener("keydown", removeSelected);
    return () =>
      frameWindow.document.removeEventListener("keydown", removeSelected);
  }, [mode, selectedId, frameWindow, post]);

  const findElement = useCallback(
    (elementId: string) =>
      [
        ...(rootRef.current?.querySelectorAll<HTMLElement>(
          "[data-pagebldr-element]",
        ) ?? []),
      ].find((element) => element.dataset.pagebldrElement === elementId) ??
      null,
    [],
  );

  const finishEditing = useCallback(
    (commit: boolean) => {
      const active = activeEdit.current;
      if (!active) return;
      active.element.contentEditable = "false";
      active.element.removeAttribute("data-pagebldr-inline-editing");
      const value = active.element.innerText;
      active.element.innerHTML = active.originalMarkup;
      if (commit) {
        post({
          type: "inline.commit",
          elementId: active.element.dataset.pagebldrElement!,
          property: active.property,
          value,
        });
      }
      activeEdit.current = null;
    },
    [post],
  );

  const startEditing = useCallback(
    (elementId: string) => {
      if (mode !== "edit" || !document) return;
      const authored = document.elements[elementId];
      const inlineEditing = authored
        ? builder.elements.get(authored.type)?.inlineEditing
        : null;
      const element = inlineEditing ? findElement(elementId) : null;
      if (!authored || authored.locked || !inlineEditing || !element) return;
      finishEditing(true);
      activeEdit.current = {
        element,
        originalMarkup: element.innerHTML,
        property: inlineEditing.property,
      };
      element.contentEditable = "true";
      element.dataset.pagebldrInlineEditing = "true";
      element.focus();
      const selection = frameWindow.getSelection();
      const range = frameWindow.document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    [builder.elements, document, findElement, finishEditing, frameWindow, mode],
  );
  const startEditingRef = useRef(startEditing);
  startEditingRef.current = startEditing;

  useEffect(() => {
    const receive = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (!isShellToCanvasMessage(value, canvasId)) return;
      const message = value;
      switch (message.type) {
        case "document.update":
          setDocument(message.document);
          setRendererEpoch((epoch) => epoch + 1);
          break;
        case "selection.update":
          setSelectedId(message.elementId);
          break;
        case "hover.update":
          setHoveredId(message.elementId);
          break;
        case "reveal": {
          const element = findElement(message.elementId);
          if (element) {
            element.scrollIntoView({
              block: "center",
              inline: "nearest",
              behavior: frameWindow.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches
                ? "instant"
                : "smooth",
            });
            post({
              type: "geometry.change",
              elementId: message.elementId,
              rect: rectValue(element.getBoundingClientRect()),
            });
          }
          break;
        }
        case "inline.start":
          startEditingRef.current(message.elementId);
          break;
      }
    };
    frameWindow.document.addEventListener(shellToCanvasEvent, receive);
    post({ type: "ready" });
    return () =>
      frameWindow.document.removeEventListener(shellToCanvasEvent, receive);
  }, [canvasId, findElement, frameWindow, post]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reportSize = () =>
      post({
        type: "content.resize",
        height: Math.max(
          frameWindow.document.body.scrollHeight,
          frameWindow.document.documentElement.scrollHeight,
        ),
      });
    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(root);
    return () => observer.disconnect();
  }, [document, frameWindow, post]);

  const activate = (target: EventTarget | null) => {
    const element = closestPageElement(target);
    post({
      type: "selection.change",
      elementId:
        element?.dataset.pagebldrElement === document?.rootId
          ? null
          : (element?.dataset.pagebldrElement ?? null),
    });
  };

  const hover = (target: EventTarget | null) => {
    const element = closestPageElement(target);
    post({
      type: "hover.change",
      elementId: element?.dataset.pagebldrElement ?? null,
    });
  };

  const dragSource = (dataTransfer: DataTransfer): CanvasDragSource | null => {
    if (mode !== "edit") return null;
    const clipboard = readBlockDrag(dataTransfer);
    if (clipboard && clipboard.elements[clipboard.rootId])
      return {
        kind: "block",
        elementType: clipboard.elements[clipboard.rootId]!.type,
        clipboard,
      };
    return elementDrag.read(dataTransfer);
  };

  const placementAt = (
    event: Pick<DragEvent<HTMLDivElement>, "target" | "clientY">,
    source: CanvasDragSource,
  ) => {
    const target = closestPageElement(event.target);
    if (!target?.dataset.pagebldrElement || !document) return null;
    const rect = target.getBoundingClientRect();
    const ratio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
    const preferred: CanvasPlacementPosition =
      ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
    const positions: readonly CanvasPlacementPosition[] = [
      preferred,
      ...(preferred === "inside"
        ? (["before", "after"] as const)
        : (["inside", preferred === "before" ? "after" : "before"] as const)),
    ];
    const moving =
      source.kind === "existing" ? document.elements[source.elementId] : null;
    const elementType =
      source.kind !== "existing" ? source.elementType : moving?.type;
    if (!elementType) return null;
    for (const position of positions) {
      const placement = resolveCanvasPlacement({
        document,
        definitions: builder.elements,
        elementType,
        targetId: target.dataset.pagebldrElement,
        position,
        ...(moving ? { movingId: moving.id } : {}),
      });
      if (placement) return { ...placement, rect };
    }
    return null;
  };

  const pointerPlacement = (x: number, y: number, elementId: string) => {
    const target = frameWindow.document
      .elementsFromPoint(x, y)
      .map(closestPageElement)
      .find((element) => element !== null);
    return target
      ? placementAt({ target, clientY: y }, { kind: "existing", elementId })
      : null;
  };
  const handleProps: ComponentProps<typeof Button> = {
    onClick(event) {
      event.stopPropagation();
      if (ignoreHandleClick.current) {
        ignoreHandleClick.current = false;
        if (event.detail !== 0) return;
      }
      if (selectedId) {
        finishEditing(true);
        post({ type: "selection.change", elementId: selectedId });
      }
    },
    onPointerDown(event) {
      ignoreHandleClick.current = false;
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        !selectedId ||
        !document ||
        activeEdit.current ||
        selectedId === document.rootId ||
        document.elements[selectedId]?.locked
      )
        return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerMove.current = {
        pointerId: event.pointerId,
        button: event.currentTarget,
        elementId: selectedId,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
    },
    onPointerMove(event) {
      const active = pointerMove.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (
        !active.dragging &&
        Math.hypot(event.clientX - active.x, event.clientY - active.y) * zoom <
          5
      )
        return;
      active.dragging = true;
      ignoreHandleClick.current = true;
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(
        pointerPlacement(event.clientX, event.clientY, active.elementId),
      );
    },
    onPointerUp(event) {
      const active = pointerMove.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const placement = active.dragging
        ? pointerPlacement(event.clientX, event.clientY, active.elementId)
        : null;
      cancelPointerMove();
      if (!active.dragging) return;
      event.preventDefault();
      event.stopPropagation();
      if (placement)
        post({
          type: "drop.request",
          source: { kind: "existing", elementId: active.elementId },
          targetId: placement.targetId,
          position: placement.position,
        });
    },
    onPointerCancel: cancelPointerMove,
    onLostPointerCapture: cancelPointerMove,
    onKeyDown(event) {
      if (!event.altKey || !selectedId || !document) return;
      const directions: Readonly<Record<string, KeyboardMoveDirection>> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "out",
        ArrowRight: "in",
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      const placement = resolveKeyboardMove({
        document,
        definitions: builder.elements,
        elementId: selectedId,
        direction,
      });
      if (placement)
        post({
          type: "drop.request",
          source: { kind: "existing", elementId: selectedId },
          targetId: placement.targetId,
          position: placement.position,
        });
    },
  };

  if (!document) return null;
  return (
    <div
      ref={rootRef}
      data-pagebldr-isolated-canvas
      onClickCapture={(event) => {
        if (
          closestElement(
            event.target,
            '[data-slot="scroll-area-scrollbar"], [data-pagebldr-ui]',
          )
        )
          return;
        const anchor = closestElement(event.target, "a[href]");
        if (anchor) event.preventDefault();
        if (mode === "edit") activate(event.target);
      }}
      onDoubleClickCapture={(event) => {
        const element = closestPageElement(event.target);
        if (element?.dataset.pagebldrElement)
          startEditing(element.dataset.pagebldrElement);
      }}
      onPointerOverCapture={(event) => hover(event.target)}
      onPointerLeave={() => post({ type: "hover.change", elementId: null })}
      onDragOverCapture={(event) => {
        const source = dragSource(event.dataTransfer);
        const placement = source ? placementAt(event, source) : null;
        setDropTarget(placement);
        if (placement) {
          event.preventDefault();
          event.dataTransfer.dropEffect =
            source?.kind === "existing" ? "move" : "copy";
        }
      }}
      onDragLeaveCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropTarget(null);
      }}
      onDropCapture={(event) => {
        const source = dragSource(event.dataTransfer);
        const placement = source ? placementAt(event, source) : null;
        elementDrag.end();
        setDropTarget(null);
        if (!source || !placement) return;
        event.preventDefault();
        post({
          type: "drop.request",
          source,
          targetId: placement.targetId,
          position: placement.position,
        });
      }}
      onBlurCapture={(event) => {
        if (
          activeEdit.current?.element === event.target &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          finishEditing(true);
      }}
      onContextMenuCapture={(event) => {
        if (mode !== "edit" || activeEdit.current) return;
        const element = closestPageElement(event.target);
        if (!element) return;
        event.preventDefault();
        event.stopPropagation();
        post({
          type: "element.context",
          elementId: element.dataset.pagebldrElement!,
          x: event.clientX,
          y: event.clientY,
        });
      }}
      onKeyDownCapture={(event) => {
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          mode === "edit" &&
          selectedId &&
          !activeEdit.current &&
          !closestElement(
            event.target,
            "input, textarea, select, [contenteditable=true], [role=textbox]",
          )
        ) {
          event.preventDefault();
          post({ type: "element.delete", elementId: selectedId });
          return;
        }
        if (event.key === "Escape" && pointerMove.current) {
          event.preventDefault();
          event.stopPropagation();
          ignoreHandleClick.current = true;
          cancelPointerMove();
          return;
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          event.key.toLowerCase() === "z" &&
          !activeEdit.current &&
          !closestElement(
            event.target,
            "input, textarea, [contenteditable='true']",
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          post({
            type: "history.request",
            action: event.shiftKey ? "redo" : "undo",
          });
          return;
        }
        if (!activeEdit.current) return;
        if (event.key === "Escape") {
          event.preventDefault();
          finishEditing(false);
        } else if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          finishEditing(true);
        }
      }}
    >
      <PagebldrRuntimeInteractions />
      <ScrollArea
        className="h-screen"
        data-pagebldr-canvas-scroll-area
        type="scroll"
        scrollHideDelay={700}
      >
        <PagebldrRenderer
          key={rendererEpoch}
          builder={builder}
          document={document}
          mode={mode}
          {...(forcedStyleState ? { forcedStyleState } : {})}
          {...(resolveApplicationDestination
            ? { resolveApplicationDestination }
            : {})}
        />
      </ScrollArea>
      {mode === "edit" ? (
        <CanvasChrome
          frameWindow={frameWindow}
          selectedId={selectedId}
          hoveredId={hoveredId}
          findElement={findElement}
          document={document}
          post={post}
          zoom={zoom}
          handleProps={handleProps}
          workspace={workspace}
        />
      ) : null}
      {mode === "edit" && dropTarget ? (
        <CanvasDropTarget placement={dropTarget} />
      ) : null}
    </div>
  );
}

function CanvasDropTarget({
  placement,
}: {
  readonly placement: CanvasPlacement & { readonly rect: DOMRect };
}) {
  const style: CSSProperties =
    placement.position === "inside"
      ? outlineStyle(placement.rect)
      : {
          position: "fixed",
          pointerEvents: "none",
          left: placement.rect.left,
          top:
            placement.position === "before"
              ? placement.rect.top - 2
              : placement.rect.bottom - 2,
          width: placement.rect.width,
          height: 4,
        };
  return (
    <div
      aria-hidden
      data-pagebldr-drop-target={placement.position}
      style={style}
    />
  );
}

function CanvasChrome({
  frameWindow,
  selectedId,
  hoveredId,
  findElement,
  document,
  post,
  zoom,
  handleProps,
  workspace,
}: {
  readonly frameWindow: Window;
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly findElement: (elementId: string) => HTMLElement | null;
  readonly document: PageDocument;
  readonly post: (message: Parameters<typeof canvasMessage>[1]) => void;
  readonly zoom: number;
  readonly handleProps: ComponentProps<typeof Button>;
  readonly workspace: HTMLDivElement | null;
}) {
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [handlePosition, setHandlePosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const canMove =
    selectedId !== document.rootId &&
    !document.elements[selectedId ?? ""]?.locked;
  const handleHint = canMove
    ? "Click to edit. Drag to move. Alt+arrow keys also move."
    : "Open the inspector. This Element cannot be moved.";

  useLayoutEffect(() => {
    const update = () => {
      const selected = selectedId ? findElement(selectedId) : null;
      const hovered = hoveredId ? findElement(hoveredId) : null;
      const nextSelected = selected?.getBoundingClientRect() ?? null;
      setSelectedRect(nextSelected);
      setHoveredRect(hovered?.getBoundingClientRect() ?? null);
      const frameRect = frameWindow.frameElement?.getBoundingClientRect();
      const workspaceRect = workspace?.getBoundingClientRect();
      if (nextSelected && frameRect && workspaceRect) {
        const left = Math.max(0, (workspaceRect.left - frameRect.left) / zoom);
        const top = Math.max(0, (workspaceRect.top - frameRect.top) / zoom);
        const right =
          (workspaceRect.left + workspace!.clientWidth - frameRect.left) / zoom;
        const bottom =
          (workspaceRect.top + workspace!.clientHeight - frameRect.top) / zoom;
        setHandlePosition(
          nextSelected.right >= left &&
            nextSelected.left <= right &&
            nextSelected.bottom >= top &&
            nextSelected.top <= bottom
            ? {
                left: Math.max(
                  left,
                  Math.min(nextSelected.right - 24 / zoom, right - 24 / zoom),
                ),
                top: Math.max(top, nextSelected.top - 24 / zoom),
              }
            : null,
        );
      } else setHandlePosition(null);
      if (selectedId && nextSelected)
        post({
          type: "geometry.change",
          elementId: selectedId,
          rect: rectValue(nextSelected),
        });
    };
    update();
    frameWindow.addEventListener("scroll", update, true);
    frameWindow.addEventListener("resize", update);
    workspace?.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    if (selectedId) {
      const selected = findElement(selectedId);
      if (selected) observer.observe(selected);
    }
    if (workspace) observer.observe(workspace);
    return () => {
      observer.disconnect();
      frameWindow.removeEventListener("scroll", update, true);
      frameWindow.removeEventListener("resize", update);
      workspace?.removeEventListener("scroll", update);
    };
  }, [
    document,
    findElement,
    frameWindow,
    hoveredId,
    post,
    selectedId,
    workspace,
    zoom,
  ]);

  return (
    <>
      {hoveredId && hoveredId !== selectedId && hoveredRect ? (
        <div
          aria-hidden
          data-pagebldr-hover-outline
          style={outlineStyle(hoveredRect)}
        />
      ) : null}
      {selectedId && selectedRect ? (
        <>
          <div
            aria-hidden
            data-pagebldr-selection-outline
            style={outlineStyle(selectedRect)}
          >
            <span>{document.elements[selectedId]?.name ?? "Element"}</span>
          </div>
          {handlePosition ? (
            <div
              data-pagebldr-ui
              style={{
                position: "fixed",
                left: handlePosition.left,
                top: handlePosition.top,
                transform: `scale(${1 / zoom})`,
                transformOrigin: "top left",
              }}
            >
              <Button
                type="button"
                size="icon-xs"
                aria-label={`Edit ${document.elements[selectedId]?.name ?? "Element"}`}
                title={handleHint}
                aria-description={handleHint}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 24,
                  height: 24,
                  minWidth: 24,
                  minHeight: 24,
                  borderRadius: "0.25rem 0.25rem 0 0",
                  background: "var(--pagebldr-focus, #2563eb)",
                  color: "var(--pagebldr-primary-foreground, #ffffff)",
                  touchAction: "none",
                  cursor: canMove ? "grab" : undefined,
                }}
                {...handleProps}
              >
                <PencilIcon data-icon="inline-start" size={12} />
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function CanvasZoomControls({
  fitEnabled,
  zoom,
  onDecrease,
  onIncrease,
  onFit,
  onToggleFit,
  onReveal,
}: {
  readonly fitEnabled: boolean;
  readonly zoom: number;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly onFit: () => void;
  readonly onToggleFit: () => void;
  readonly onReveal: () => void;
}) {
  const dimensions = useCanvasDimensions();
  return (
    <>
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex w-fit items-center gap-1 rounded-md border bg-background p-1 shadow-sm @max-[1024px]:bottom-3 @max-[600px]:left-[calc(50%-1.25rem)] @max-[1024px]:rounded-xl @max-[1024px]:shadow-lg"
        onPointerEnter={dimensions.show}
        onPointerLeave={dimensions.hideSoon}
        onFocusCapture={dimensions.show}
        onBlurCapture={dimensions.hideSoon}
      >
        <CanvasTool label="Zoom out" icon={MinusIcon} onClick={onDecrease} />
        <Button
          aria-label="Fit canvas width"
          className="min-w-12 px-1 text-xs tabular-nums"
          size="sm"
          variant="ghost"
          onClick={onFit}
        >
          {fitEnabled ? "Fit " : ""}
          {Math.round(zoom * 100)}%
        </Button>
        <CanvasTool label="Zoom in" icon={PlusIcon} onClick={onIncrease} />
        <CanvasTool
          label={fitEnabled ? "Stop fitting canvas" : "Fit canvas width"}
          icon={Maximize2Icon}
          pressed={fitEnabled}
          onClick={onToggleFit}
        />
        <div className="@max-[600px]:hidden">
          <CanvasTool
            label="Scroll to selection"
            icon={LocateFixedIcon}
            onClick={onReveal}
          />
        </div>
      </div>
    </>
  );
}

function CanvasTool({
  label,
  icon: Icon,
  onClick,
  pressed,
}: {
  readonly label: string;
  readonly icon: typeof MinusIcon;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          aria-pressed={pressed}
          size="icon-sm"
          variant={pressed ? "secondary" : "ghost"}
          onClick={onClick}
        >
          <Icon />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CanvasViewportIndicator({
  fixedDesktop,
  height,
  settings,
  width,
}: {
  readonly fixedDesktop: boolean;
  readonly height: number;
  readonly settings: PageDocument["settings"];
  readonly width: number;
}) {
  const dimensions = useCanvasDimensions();
  const range = canvasBreakpointRange(width, settings);
  const Icon =
    range === "mobile"
      ? SmartphoneIcon
      : range === "tablet"
        ? TabletIcon
        : null;
  const breakpointLabel =
    range === "mobile"
      ? `Phone · max width ${settings.breakpoints.mobileMax}px`
      : range === "tablet"
        ? `Tablet · max width ${settings.breakpoints.tabletMax}px`
        : null;

  if (!dimensions.visible) return null;

  return (
    <div className="pointer-events-none sticky top-3 z-20 ml-auto h-0 w-fit @max-[1024px]:hidden">
      <div
        className="pointer-events-auto flex h-9 items-center gap-1 rounded-lg border bg-background px-3 text-xs tabular-nums shadow-sm"
        onPointerEnter={dimensions.show}
        onPointerLeave={dimensions.hideSoon}
        onFocusCapture={dimensions.show}
        onBlurCapture={dimensions.hideSoon}
      >
        <span>
          {Math.round(width)}px × {height}px{fixedDesktop ? " (16:9)" : ""}
        </span>
        {Icon && breakpointLabel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                aria-label={breakpointLabel}
                size="icon-xs"
                variant="ghost"
              >
                <Icon data-icon="inline-end" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="whitespace-nowrap">
              {breakpointLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

function outlineStyle(rect: DOMRect): CSSProperties {
  return {
    position: "fixed",
    pointerEvents: "none",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function rectValue(rect: DOMRect): CanvasRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function revealRect(
  workspace: HTMLDivElement | null,
  frame: HTMLIFrameElement | null,
  rect: CanvasRect,
  zoom: number,
) {
  if (!workspace || !frame) return;
  const workspaceRect = workspace.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const left =
    frameRect.left -
    workspaceRect.left -
    workspace.clientLeft +
    workspace.scrollLeft +
    rect.x * zoom;
  const top =
    frameRect.top -
    workspaceRect.top -
    workspace.clientTop +
    workspace.scrollTop +
    rect.y * zoom;
  const width = rect.width * zoom;
  const height = rect.height * zoom;
  workspace.scrollTo({
    left: Math.max(
      0,
      width >= workspace.clientWidth
        ? left - 24
        : left - (workspace.clientWidth - width) / 2,
    ),
    top: Math.max(
      0,
      height >= workspace.clientHeight
        ? top - 24
        : top - (workspace.clientHeight - height) / 2,
    ),
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function closestPageElement(target: EventTarget | null) {
  return closestElement(
    target,
    "[data-pagebldr-element]",
  ) as HTMLElement | null;
}

function closestElement(target: EventTarget | null, selector: string) {
  return isDomElement(target) ? target.closest(selector) : null;
}

function isDomElement(value: EventTarget | null): value is Element {
  return !!value && "nodeType" in value && value.nodeType === 1;
}

function isInteractiveTarget(value: EventTarget | null) {
  return (
    isDomElement(value) &&
    (value.closest(
      "input, textarea, select, button, a[href], [role='textbox'], [role='combobox'], [role='slider'], [role='radio'], [role='switch'], [role='menuitem'], [role='option']",
    ) ||
      (value as HTMLElement).isContentEditable)
  );
}

function installPackageStyles(source: Document, target: Document) {
  const css: string[] = [];
  for (const stylesheet of source.styleSheets) {
    try {
      for (const rule of stylesheet.cssRules)
        if (rule.cssText.includes("pagebldr")) css.push(rule.cssText);
    } catch {
      // Cross-origin Host stylesheets are intentionally ignored.
    }
  }
  const style = target.createElement("style");
  style.dataset.pagebldrFrameStyles = "true";
  style.textContent = css.join("\n");
  target.head.append(style);
}

const shellToCanvasEvent = "pagebldr:shell-message";
const canvasToShellEvent = "pagebldr:canvas-message";

const frameHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#pagebldr-canvas-root{min-height:100%;margin:0}</style></head><body><div id="pagebldr-canvas-root"></div><script>window.addEventListener("message",function(event){document.dispatchEvent(new CustomEvent("${shellToCanvasEvent}",{detail:event.data}))});document.addEventListener("${canvasToShellEvent}",function(event){window.parent.postMessage(event.detail,"*")});</script></body></html>`;
