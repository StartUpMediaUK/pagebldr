"use client";

import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  ClipboardPasteIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  Layers3Icon,
  Link2OffIcon,
  LockIcon,
  MenuIcon,
  MonitorOffIcon,
  Minimize2Icon,
  PackagePlusIcon,
  PanelTopCloseIcon,
  PencilIcon,
  Trash2Icon,
  UnlockIcon,
  XIcon,
} from "lucide-react";

import type { PagebldrClipboard, PagebldrStyleClipboard } from "@pagebldr/core";

import { Button } from "../components/ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import { ScrollArea } from "../components/ui/scroll-area.js";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import {
  createElementClipboard,
  pagebldrElementDragType,
  pagebldrExistingDragType,
  resolveCanvasPlacement,
  resolveClickInsertion,
  resolveKeyboardMove,
} from "./canvas-placement.js";
import { usePagebldrEditor } from "./context.js";
import { useMovableOverlay } from "./movable-overlay.js";
import {
  defaultExpandedStructureIds,
  hasBrokenAnchorReference,
  responsiveHiddenBreakpoints,
  structureKeyAction,
  visibleStructureRows,
} from "./structure-controller.js";

export interface StructureWindowProps {
  readonly clipboard: PagebldrClipboard | null;
  readonly open: boolean;
  readonly onClipboardChange: (clipboard: PagebldrClipboard) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onStyleClipboardChange: (clipboard: PagebldrStyleClipboard) => void;
  readonly styleClipboard: PagebldrStyleClipboard | null;
}

export function StructureWindow({
  clipboard,
  open,
  onClipboardChange,
  onOpenChange,
  onStyleClipboardChange,
  styleClipboard,
}: StructureWindowProps) {
  const editor = usePagebldrEditor();
  const movable = useMovableOverlay();
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
    defaultExpandedStructureIds(editor.document),
  );

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      next.add(editor.document.rootId);
      return next;
    });
  }, [editor.document.rootId]);

  if (!open) return null;

  const resetWindow = () => {
    movable.reset();
    setMinimized(false);
    movable.ref.current?.style.removeProperty("width");
    movable.ref.current?.style.removeProperty("height");
  };

  const toggleExpanded = (elementId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);
      return next;
    });

  const rows = visibleStructureRows(editor.document, expanded);
  const onTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || !editor.selectedId) return;
    if (!isTreeArrow(event.key)) return;
    const action = structureKeyAction({
      document: editor.document,
      expanded,
      selectedId: editor.selectedId,
      key: event.key,
    });
    if (!action) return;
    event.preventDefault();
    if (action.type === "select") editor.select(action.elementId);
    else if (action.type === "expand")
      setExpanded((current) => new Set([...current, action.elementId]));
    else
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(action.elementId);
        return next;
      });
  };

  return (
    <div
      ref={movable.ref}
      className="absolute bottom-16 right-5 z-30 flex h-[min(28rem,calc(100%-2.5rem))] w-[22rem] min-w-72 max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-xl [resize:both]"
      style={{
        ...movable.style,
        ...(minimized ? { height: "auto", resize: "none" } : {}),
      }}
      data-pagebldr-structure-window
    >
      <div
        className="flex cursor-move touch-none items-center gap-2 border-b px-3 py-2"
        onDoubleClick={resetWindow}
        onPointerDown={movable.beginMove}
      >
        <GripVerticalIcon className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers3Icon className="size-4" />
            Structure
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Page hierarchy and element controls
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Collapse all structure rows"
              size="icon-xs"
              variant="ghost"
              onClick={() => setExpanded(new Set([editor.document.rootId]))}
            >
              <PanelTopCloseIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collapse all</TooltipContent>
        </Tooltip>
        <Button
          aria-label={minimized ? "Restore Structure" : "Minimize Structure"}
          size="icon-xs"
          variant="ghost"
          onClick={() => setMinimized((current) => !current)}
        >
          <Minimize2Icon />
        </Button>
        <Button
          aria-label="Close Structure"
          size="icon-xs"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          <XIcon />
        </Button>
      </div>
      {!minimized ? (
        <ScrollArea className="min-h-0 flex-1">
          <div
            className="flex flex-col gap-0.5 p-2"
            role="tree"
            aria-label="Page structure"
            onKeyDown={onTreeKeyDown}
          >
            {rows.map((row) => {
              const element = editor.document.elements[row.id]!;
              const hiddenBreakpoints = responsiveHiddenBreakpoints(element);
              const hasBrokenReference = hasBrokenAnchorReference(
                element,
                editor.document,
              );
              return (
                <div
                  key={row.id}
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-selected={editor.selectedId === row.id}
                  aria-expanded={
                    row.hasChildren ? expanded.has(row.id) : undefined
                  }
                  className="group flex min-w-0 items-center rounded-md data-[selected=true]:bg-accent"
                  data-selected={editor.selectedId === row.id}
                  onPointerEnter={() => editor.hover(row.id)}
                  onPointerLeave={() => editor.hover(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropOnRow(event, row.id)}
                >
                  <span
                    style={{ width: row.depth * 14 }}
                    className="shrink-0"
                  />
                  {row.hasChildren ? (
                    <Button
                      aria-label={`${expanded.has(row.id) ? "Collapse" : "Expand"} ${element.name}`}
                      className="size-6 shrink-0"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => toggleExpanded(row.id)}
                      tabIndex={-1}
                    >
                      {expanded.has(row.id) ? (
                        <ChevronDownIcon />
                      ) : (
                        <ChevronRightIcon />
                      )}
                    </Button>
                  ) : (
                    <span aria-hidden="true" className="size-6 shrink-0" />
                  )}
                  <button
                    type="button"
                    className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded px-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => editor.select(row.id)}
                    draggable={
                      editor.mode === "edit" &&
                      row.id !== editor.document.rootId &&
                      !element.locked
                    }
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        pagebldrExistingDragType,
                        row.id,
                      );
                    }}
                  >
                    {!element.hidden &&
                    !element.locked &&
                    hiddenBreakpoints.length === 0 &&
                    !hasBrokenReference ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
                    ) : null}
                    <span className="truncate">{element.name}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
                      {element.hidden ? (
                        <EyeOffIcon
                          aria-label="Hidden on all breakpoints"
                          className="size-3.5"
                        />
                      ) : null}
                      {hiddenBreakpoints.length ? (
                        <MonitorOffIcon
                          aria-label={`Hidden on ${hiddenBreakpoints.join(", ")}`}
                          className="size-3.5"
                        />
                      ) : null}
                      {element.locked ? (
                        <LockIcon aria-label="Locked" className="size-3.5" />
                      ) : null}
                      {hasBrokenReference ? (
                        <Link2OffIcon
                          aria-label="Broken internal link"
                          className="size-3.5 text-destructive"
                        />
                      ) : null}
                    </span>
                  </button>
                  <StructureMenu
                    elementId={row.id}
                    clipboard={clipboard}
                    styleClipboard={styleClipboard}
                    onCopy={onClipboardChange}
                    onCopyStyles={onStyleClipboardChange}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );

  function dropOnRow(event: DragEvent<HTMLDivElement>, targetId: string) {
    if (editor.mode !== "edit") return;
    const movingId = event.dataTransfer.getData(pagebldrExistingDragType);
    const elementType = event.dataTransfer.getData(pagebldrElementDragType);
    const moving = movingId ? editor.document.elements[movingId] : null;
    const type = elementType || moving?.type;
    if (!type) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const position =
      ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
    const placement = resolveCanvasPlacement({
      document: editor.document,
      definitions: editor.builder.elements,
      elementType: type,
      targetId,
      position,
      ...(moving ? { movingId: moving.id } : {}),
    });
    if (!placement) return;
    event.preventDefault();
    if (moving)
      editor.dispatch({
        type: "move",
        elementId: moving.id,
        parentId: placement.parentId,
        index: placement.index,
      });
    else {
      const definition = editor.builder.elements.get(type);
      if (definition)
        editor.dispatch({
          type: "insert",
          parentId: placement.parentId,
          index: placement.index,
          clipboard: createElementClipboard(definition),
        });
    }
  }
}

function StructureMenu({
  clipboard,
  elementId,
  onCopy,
  onCopyStyles,
  styleClipboard,
}: {
  readonly clipboard: PagebldrClipboard | null;
  readonly elementId: string;
  readonly onCopy: (clipboard: PagebldrClipboard) => void;
  readonly onCopyStyles: (clipboard: PagebldrStyleClipboard) => void;
  readonly styleClipboard: PagebldrStyleClipboard | null;
}) {
  const editor = usePagebldrEditor();
  const element = editor.document.elements[elementId]!;
  const root = elementId === editor.document.rootId;
  const readOnly = editor.mode !== "edit";
  const movePlacements = {
    up: resolveKeyboardMove({
      document: editor.document,
      definitions: editor.builder.elements,
      elementId,
      direction: "up",
    }),
    down: resolveKeyboardMove({
      document: editor.document,
      definitions: editor.builder.elements,
      elementId,
      direction: "down",
    }),
    in: resolveKeyboardMove({
      document: editor.document,
      definitions: editor.builder.elements,
      elementId,
      direction: "in",
    }),
    out: resolveKeyboardMove({
      document: editor.document,
      definitions: editor.builder.elements,
      elementId,
      direction: "out",
    }),
  } as const;
  const move = (direction: "down" | "in" | "out" | "up") => {
    const placement = movePlacements[direction];
    if (placement)
      editor.dispatch({
        type: "move",
        elementId,
        parentId: placement.parentId,
        index: placement.index,
      });
  };
  const pastePlacement = clipboard
    ? resolveClickInsertion({
        document: editor.document,
        definitions: editor.builder.elements,
        elementType: clipboard.elements[clipboard.rootId]!.type,
        selectedId: elementId,
      })
    : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${element.name}`}
          className="mr-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          size="icon-xs"
          variant="ghost"
        >
          <MenuIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{element.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => editor.select(elementId)}>
          <PencilIcon /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || root || element.locked}
          onSelect={() => {
            const name = window.prompt("Element name", element.name)?.trim();
            if (name) editor.dispatch({ type: "rename", elementId, name });
          }}
        >
          <PencilIcon /> Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={root}
          onSelect={() =>
            onCopy(
              editor.builder.editor.clipboard.copy(editor.document, elementId),
            )
          }
        >
          <ClipboardCopyIcon /> Copy
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || !pastePlacement || !clipboard}
          onSelect={() => {
            if (clipboard && pastePlacement)
              editor.dispatch({
                type: "paste",
                parentId: pastePlacement.parentId,
                index: pastePlacement.index,
                clipboard,
              });
          }}
        >
          <ClipboardPasteIcon /> Paste
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || root || element.locked}
          onSelect={() => editor.dispatch({ type: "duplicate", elementId })}
        >
          <CopyIcon /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            onCopyStyles(
              editor.builder.editor.clipboard.copyStyles(
                editor.document,
                elementId,
              ),
            )
          }
        >
          <ClipboardCopyIcon /> Copy styles
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || element.locked || !styleClipboard}
          onSelect={() => {
            if (styleClipboard)
              editor.dispatch({
                type: "paste-styles",
                elementId,
                clipboard: styleClipboard,
              });
          }}
        >
          <ClipboardPasteIcon /> Paste styles
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={readOnly || !movePlacements.up}
          onSelect={() => move("up")}
        >
          <ArrowUpIcon /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || !movePlacements.down}
          onSelect={() => move("down")}
        >
          <ArrowDownIcon /> Move down
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || !movePlacements.in}
          onSelect={() => move("in")}
        >
          <ArrowRightIcon /> Indent
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly || !movePlacements.out}
          onSelect={() => move("out")}
        >
          <ArrowLeftIcon /> Outdent
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={readOnly || root || element.locked}
          onSelect={() =>
            editor.dispatch({
              type: "set-hidden",
              elementId,
              hidden: !element.hidden,
            })
          }
        >
          {element.hidden ? <EyeIcon /> : <EyeOffIcon />}
          {element.hidden ? "Show" : "Hide"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={readOnly}
          onSelect={() =>
            editor.dispatch({
              type: "set-locked",
              elementId,
              locked: !element.locked,
            })
          }
        >
          {element.locked ? <UnlockIcon /> : <LockIcon />}
          {element.locked ? "Unlock" : "Lock"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          title="Add a Host Block source to enable this action."
        >
          <PackagePlusIcon /> Save as Block
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={readOnly || root || element.locked}
          onSelect={() => {
            editor.dispatch({ type: "remove", elementId });
            editor.select(editor.document.rootId);
          }}
        >
          <Trash2Icon /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isTreeArrow(
  key: string,
): key is "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" {
  return ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(key);
}
