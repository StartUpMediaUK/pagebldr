"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  LocateFixedIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  SmartphoneIcon,
  TabletIcon,
  ZoomInIcon,
} from "lucide-react";

import type { Pagebldr, PageDocument, ResourceReference } from "@pagebldr/core";

import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
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
} from "./canvas-controller.js";
import { useCanvasDimensions } from "./canvas-dimensions-context.js";
import {
  createElementClipboard,
  pagebldrElementDragType,
  pagebldrExistingDragType,
  resolveCanvasPlacement,
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
import { usePagebldrEditor } from "./context.js";

type CanvasStatus = "loading" | "ready" | "error";

export function IsolatedCanvas({
  children,
}: {
  readonly children?: ReactNode;
}) {
  const editor = usePagebldrEditor();
  const editorRef = useRef(editor);
  const generatedId = useId();
  const canvasId = `canvas-${generatedId.replaceAll(":", "")}`;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [status, setStatus] = useState<CanvasStatus>("loading");
  const [error, setError] = useState("");
  const [contentHeight, setContentHeight] = useState(900);
  const [workspaceSize, setWorkspaceSize] = useState({
    width: 900,
    height: 700,
  });
  const [zoom, setZoom] = useState(1);
  const [fitEnabled, setFitEnabled] = useState(false);
  const zoomRef = useRef(zoom);
  const [geometry, setGeometry] = useState<{
    readonly elementId: string;
    readonly rect: CanvasRect;
  } | null>(null);
  const revealTarget = useRef<string | null>(null);
  const previousSelection = useRef(editor.selectedId);
  editorRef.current = editor;
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
        case "hover.change":
          current.hover(message.elementId);
          break;
        case "geometry.change":
          setGeometry({ elementId: message.elementId, rect: message.rect });
          if (revealTarget.current === message.elementId) {
            revealTarget.current = null;
            revealRect(workspaceRef.current, message.rect, zoomRef.current);
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
            message.source.kind === "element"
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
          if (message.source.kind === "existing")
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
        event.key !== "Enter" ||
        !editor.selectedId ||
        isTextEntry(event.target)
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
  const scaledHeight = contentHeight * zoom;
  const fitZoom = fitCanvasZoom({
    canvasWidth,
    availableWidth: workspaceSize.width,
  });
  const visibleCanvasHeight = canvasViewportHeight(workspaceSize.height, zoom);
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
    if (fitEnabled) setZoom(fitZoom);
  }, [fitEnabled, fitZoom]);

  const loadFrame = () => {
    const document = frameRef.current?.contentDocument;
    if (!document) {
      setStatus("error");
      setError("The isolated canvas document could not be opened.");
      return;
    }
    installPackageStyles(window.document, document);
    setFrameDocument(document);
  };

  return (
    <div
      ref={workspaceRef}
      className="relative h-full overflow-auto bg-muted p-4"
      data-pagebldr-canvas-workspace
      data-canvas-status={status}
    >
      {children ? (
        <div className="pointer-events-none absolute inset-0">{children}</div>
      ) : null}
      <CanvasViewportIndicator
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
          className="absolute left-0 top-0 block rounded-md border-0 bg-background shadow-sm"
          style={{
            width: canvasWidth,
            height: contentHeight,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
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
      <CanvasZoomControls
        fitEnabled={fitEnabled}
        zoom={zoom}
        onDecrease={() => changeZoom(-1)}
        onIncrease={() => changeZoom(1)}
        onFit={enableFit}
        onToggleFit={toggleFit}
        onReveal={() => {
          if (geometry?.elementId === editor.selectedId)
            revealRect(workspaceRef.current, geometry.rect, zoom);
          else if (editor.selectedId) {
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
  forcedStyleState,
  resolveApplicationDestination,
}: {
  readonly builder: Pagebldr;
  readonly canvasId: string;
  readonly frameWindow: Window;
  readonly mode: "edit" | "preview";
  readonly forcedStyleState: {
    readonly elementId: string;
    readonly state: "hover" | "focusVisible";
  } | null;
  readonly resolveApplicationDestination:
    ((reference: ResourceReference) => string | null) | undefined;
}) {
  const [document, setDocument] = useState<PageDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [dropTarget, setDropTarget] = useState<
    (CanvasPlacement & { readonly rect: DOMRect }) | null
  >(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
          if (element)
            post({
              type: "geometry.change",
              elementId: message.elementId,
              rect: rectValue(element.getBoundingClientRect()),
            });
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
    if (!element) return;
    post({
      type: "selection.change",
      elementId: element.dataset.pagebldrElement!,
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
    const elementType = dataTransfer.getData(pagebldrElementDragType);
    if (elementType) return { kind: "element", elementType };
    const elementId = dataTransfer.getData(pagebldrExistingDragType);
    return elementId ? { kind: "existing", elementId } : null;
  };

  const placementAt = (
    event: DragEvent<HTMLDivElement>,
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
      source.kind === "element" ? source.elementType : moving?.type;
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

  if (!document) return null;
  return (
    <div
      ref={rootRef}
      data-pagebldr-isolated-canvas
      onClickCapture={(event) => {
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
      onKeyDownCapture={(event) => {
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
      {mode === "edit" ? (
        <CanvasChrome
          frameWindow={frameWindow}
          selectedId={selectedId}
          hoveredId={hoveredId}
          findElement={findElement}
          document={document}
          post={post}
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
}: {
  readonly frameWindow: Window;
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly findElement: (elementId: string) => HTMLElement | null;
  readonly document: PageDocument;
  readonly post: (message: Parameters<typeof canvasMessage>[1]) => void;
}) {
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const selected = selectedId ? findElement(selectedId) : null;
      const hovered = hoveredId ? findElement(hoveredId) : null;
      const nextSelected = selected?.getBoundingClientRect() ?? null;
      setSelectedRect(nextSelected);
      setHoveredRect(hovered?.getBoundingClientRect() ?? null);
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
    const observer = new ResizeObserver(update);
    if (selectedId) {
      const selected = findElement(selectedId);
      if (selected) observer.observe(selected);
    }
    return () => {
      observer.disconnect();
      frameWindow.removeEventListener("scroll", update, true);
      frameWindow.removeEventListener("resize", update);
    };
  }, [document, findElement, frameWindow, hoveredId, post, selectedId]);

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
        <div
          aria-hidden
          data-pagebldr-selection-outline
          style={outlineStyle(selectedRect)}
        >
          <span>{document.elements[selectedId]?.name ?? "Element"}</span>
        </div>
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
        className="sticky bottom-3 mx-auto flex w-fit items-center gap-1 rounded-md border bg-background p-1 shadow-sm @max-[900px]:hidden"
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
          {Math.round(zoom * 100)}%
        </Button>
        <CanvasTool label="Zoom in" icon={PlusIcon} onClick={onIncrease} />
        <CanvasTool
          label={fitEnabled ? "Stop fitting canvas" : "Fit canvas width"}
          icon={Maximize2Icon}
          pressed={fitEnabled}
          onClick={onToggleFit}
        />
        <CanvasTool
          label="Scroll to selection"
          icon={LocateFixedIcon}
          onClick={onReveal}
        />
      </div>
      <div className="sticky bottom-16 mx-auto hidden w-fit @max-[900px]:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Canvas zoom ${Math.round(zoom * 100)}%`}
              className="h-11 shadow-sm"
              variant="outline"
            >
              <ZoomInIcon data-icon="inline-start" />
              {Math.round(zoom * 100)}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuLabel>Canvas zoom</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onDecrease}>
              <MinusIcon /> Zoom out
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onIncrease}>
              <PlusIcon /> Zoom in
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={fitEnabled}
              onSelect={onToggleFit}
            >
              <Maximize2Icon /> Fit canvas
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onSelect={onReveal}>
              <LocateFixedIcon /> Scroll to selection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  height,
  settings,
  width,
}: {
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
    <div className="pointer-events-none sticky top-3 z-20 ml-auto h-0 w-fit @max-[900px]:hidden">
      <div
        className="pointer-events-auto flex h-9 items-center gap-1 rounded-lg border bg-background px-3 text-xs tabular-nums shadow-sm"
        onPointerEnter={dimensions.show}
        onPointerLeave={dimensions.hideSoon}
        onFocusCapture={dimensions.show}
        onBlurCapture={dimensions.hideSoon}
      >
        <span>
          {Math.round(width)}px × {height}px
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
  rect: CanvasRect,
  zoom: number,
) {
  if (!workspace) return;
  const top = rect.y * zoom;
  const height = rect.height * zoom;
  const target =
    height >= workspace.clientHeight
      ? top - 24
      : top - (workspace.clientHeight - height) / 2;
  workspace.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
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

function isTextEntry(value: EventTarget | null) {
  return (
    isDomElement(value) &&
    (value.matches("input, textarea, select") ||
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
