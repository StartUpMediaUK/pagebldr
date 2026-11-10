"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createEditorComposition,
  defineEditorContribution,
  type EditorCapability,
  type EditorContribution,
  type EditorContributionContext,
} from "./composition.js";
import {
  ChevronLeftIcon,
  Columns2Icon,
  Columns3Icon,
  Grid2X2Icon,
  Rows3Icon,
  EyeIcon,
  LaptopIcon,
  Layers3Icon,
  MoreHorizontalIcon,
  PaletteIcon,
  PanelLeftIcon,
  ChevronDownIcon,
  PlusIcon,
  PencilIcon,
  Redo2Icon,
  SaveIcon,
  HistoryIcon,
  SmartphoneIcon,
  TabletIcon,
  Undo2Icon,
} from "lucide-react";

import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../components/ui/empty.js";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import {
  InspectorSelect as NativeSelect,
  InspectorSelectOption as NativeSelectOption,
} from "./inspector-select.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover.js";
import { ScrollArea } from "../components/ui/scroll-area.js";
import { Separator } from "../components/ui/separator.js";
import { Switch } from "../components/ui/switch.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs.js";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import { cn } from "../lib/utils.js";

import type {
  PagebldrClipboard,
  PagebldrStyleClipboard,
  ElementControl,
  ElementControlVisibilityCondition,
  PageElement,
} from "@pagebldr/core";
import type { PagebldrEditorProps } from "../index.js";
import {
  EditorProvider,
  usePagebldrEditor,
  useEditorSelectionVersion,
  type ApplicationDestinationOption,
  type EditorViewport,
} from "./context.js";
import { standardEditorPreset } from "./presets.js";
import { IsolatedCanvas } from "./isolated-canvas.js";
import { useMovableOverlay } from "./movable-overlay.js";
import { StructureWindow, StructureMenu } from "./structure-window.js";
import { WorkspacePanels } from "./workspace-panels.js";
import {
  resolveClickInsertion,
  resolveKeyboardMove,
} from "./canvas-placement.js";
import { useCanvasDimensions } from "./canvas-dimensions-context.js";
import { DestinationControl } from "./destination-control.js";
import { AnchorControl } from "./anchor-control.js";
import { CollectionControl } from "./collection-control.js";
import { RichTextControl } from "./rich-text-control.js";
import { LibraryPanel } from "./library-panel.js";
import { MediaControl } from "./media-control.js";
import { SliderField } from "./slider-field.js";
import { ColorField } from "./color-field.js";
import {
  propertyControlLabel,
  propertyOptionIcon,
} from "./property-presentation.js";
import { StyleControls, styleBreakpointFromViewport } from "./style-control.js";
import { replaceStyleProperties } from "./style-layer.js";
import { PageDesignDialog } from "./page-design-dialog.js";
import { HistorySheet } from "./history-sheet.js";
import { LifecycleDialogs } from "./lifecycle-dialogs.js";
import {
  ValidatedInputField,
  parseNumberDraft,
  formatLocalDateTime,
  parseLocalDateTime,
} from "./validated-input-field.js";

const emptySubscribe = () => () => undefined;
const emptySnapshot = () => null;

export function EditorShell(props: PagebldrEditorProps) {
  const lifecycleState = useSyncExternalStore(
    props.lifecycle?.subscribe ?? emptySubscribe,
    props.lifecycle?.getSnapshot ?? emptySnapshot,
    props.lifecycle?.getSnapshot ?? emptySnapshot,
  );
  return (
    <EditorProvider
      {...(props.librarySource ? { librarySource: props.librarySource } : {})}
      applicationDestinations={props.applicationDestinations ?? []}
      builder={props.builder}
      document={props.document}
      mode={
        lifecycleState?.readOnlyReason ||
        lifecycleState?.recovery ||
        lifecycleState?.pending === "restore"
          ? "readOnly"
          : (props.mode ?? "edit")
      }
      onChange={props.onChange}
      {...(props.resolveApplicationDestination
        ? {
            resolveApplicationDestination: props.resolveApplicationDestination,
          }
        : {})}
    >
      <TooltipProvider>
        <EditorWorkspace {...props} />
      </TooltipProvider>
    </EditorProvider>
  );
}

function EditorWorkspace({
  className,
  contributions = [],
  onPublish,
  onSave,
  preset = standardEditorPreset,
  lifecycle,
}: PagebldrEditorProps) {
  const lifecycleState = useSyncExternalStore(
    lifecycle?.subscribe ?? emptySubscribe,
    lifecycle?.getSnapshot ?? emptySnapshot,
    lifecycle?.getSnapshot ?? emptySnapshot,
  );
  const editor = usePagebldrEditor();
  const selectionVersion = useEditorSelectionVersion();
  const [pending, setPending] = useState<"save" | "publish" | null>(null);
  const [legacyStatus, setStatus] = useState("Ready");
  const status = lifecycleState
    ? {
        saved: "Saved",
        dirty: "Unsaved",
        saving: "Saving…",
        failed: "Failed",
        conflict: "Conflict",
      }[lifecycleState.status]
    : legacyStatus;
  const canSave = !!lifecycle || !!onSave;
  const canPublish = lifecycle
    ? lifecycle.capabilities.publication
    : !!onPublish;
  const lifecycleBlocked =
    !!lifecycleState &&
    (lifecycleState.status === "conflict" ||
      !!lifecycleState.recovery ||
      !!lifecycleState.pending ||
      !!lifecycleState.readOnlyReason);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [compact, setCompact] = useState(false);
  const [panelMode, setPanelMode] = useState<"add" | "inspector">("add");
  const [structureOpen, setStructureOpen] = useState(true);
  const [elementContext, setElementContext] = useState<{
    elementId: string;
    x: number;
    y: number;
    sequence: number;
  } | null>(null);
  const [pageDesignOpen, setPageDesignOpen] = useState(false);
  const [clipboard, setClipboard] = useState<PagebldrClipboard | null>(null);
  const [styleClipboard, setStyleClipboard] =
    useState<PagebldrStyleClipboard | null>(null);
  const editorRootRef = useRef<HTMLElement>(null);
  const moreActionsRef = useRef<HTMLButtonElement>(null);
  const initializedLayout = useRef(false);
  const savedDocument = useRef(editor.document);
  const panelOverlay = useMovableOverlay<HTMLElement>({
    preserveSize: true,
    enabled: (element) =>
      (element.closest<HTMLElement>("[data-pagebldr-editor]")?.clientWidth ??
        1024) < 1024,
  });
  const readOnly = editor.mode !== "edit" || editor.previewing;

  const perform = useCallback(
    async (kind: "save" | "publish") => {
      if (lifecycle) {
        try {
          await (kind === "save" ? lifecycle.save() : lifecycle.publish());
        } catch {
          /* Shared lifecycle state exposes failure/conflict to the shell. */
        }
        return;
      }
      const callback = kind === "save" ? onSave : onPublish;
      if (!callback) return;
      setPending(kind);
      setStatus(`${kind === "save" ? "Saving" : "Publishing"}…`);
      try {
        const signal = new AbortController().signal;
        if (kind === "save")
          await onSave?.({
            document: editor.document,
            reason: "manual",
            signal,
          });
        else await onPublish?.({ document: editor.document, signal });
        if (kind === "save") savedDocument.current = editor.document;
        setStatus(kind === "save" ? "Saved" : "Published");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : `${kind} failed`);
      } finally {
        setPending(null);
      }
    },
    [editor.document, lifecycle, onPublish, onSave],
  );
  useEffect(() => {
    lifecycle?.observe(editor.document);
  }, [lifecycle, editor.document]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (event.key === "Escape" && editor.previewing) {
        event.preventDefault();
        editor.setPreviewing(false);
        return;
      }
      if (editor.previewing) return;
      if (
        modifier &&
        event.key.toLowerCase() === "s" &&
        canSave &&
        !readOnly &&
        !lifecycleBlocked
      ) {
        event.preventDefault();
        void perform("save");
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (modifier && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setStructureOpen((current) => !current);
        return;
      }
      if (
        modifier &&
        event.key.toLowerCase() === "c" &&
        editor.selectedId &&
        editor.selectedId !== editor.document.rootId
      ) {
        event.preventDefault();
        setClipboard(
          editor.builder.editor.clipboard.copy(
            editor.document,
            editor.selectedId,
          ),
        );
        return;
      }
      if (
        modifier &&
        event.key.toLowerCase() === "v" &&
        clipboard &&
        !readOnly
      ) {
        const copied = clipboard.elements[clipboard.rootId];
        const placement = copied
          ? resolveClickInsertion({
              document: editor.document,
              definitions: editor.builder.elements,
              elementType: copied.type,
              selectedId: editor.selectedId,
            })
          : null;
        if (placement) {
          event.preventDefault();
          editor.dispatch({
            type: "paste",
            parentId: placement.parentId,
            index: placement.index,
            clipboard,
          });
        }
        return;
      }
      if (
        modifier &&
        event.key.toLowerCase() === "d" &&
        editor.selectedId &&
        editor.selectedId !== editor.document.rootId &&
        !readOnly &&
        !editor.selected?.locked
      ) {
        event.preventDefault();
        editor.dispatch({ type: "duplicate", elementId: editor.selectedId });
        return;
      }
      if (
        event.altKey &&
        !modifier &&
        editor.selectedId &&
        !readOnly &&
        !isEditableTarget(event.target)
      ) {
        const direction = keyboardMoveDirection(event.key);
        const placement = direction
          ? resolveKeyboardMove({
              document: editor.document,
              definitions: editor.builder.elements,
              elementId: editor.selectedId,
              direction,
            })
          : null;
        if (placement) {
          event.preventDefault();
          editor.dispatch({
            type: "move",
            elementId: editor.selectedId,
            parentId: placement.parentId,
            index: placement.index,
          });
          return;
        }
      }
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.redo();
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        editor.selectedId &&
        editor.selectedId !== editor.document.rootId &&
        !editor.selected?.locked &&
        !readOnly
      ) {
        event.preventDefault();
        editor.dispatch({ type: "remove", elementId: editor.selectedId });
        editor.select(editor.document.rootId);
      }
      if (event.key === "Escape") {
        editor.select(editor.document.rootId);
        setPanelMode("add");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clipboard, editor, canSave, lifecycleBlocked, perform, readOnly]);

  useEffect(() => {
    const root = editorRootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setCompact(entry.contentRect.width < 1024);
      if (initializedLayout.current) return;
      initializedLayout.current = true;
      if (entry.contentRect.width < 1024) {
        setPanelOpen(false);
        setStructureOpen(false);
      }
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const compactLayout = (editorRootRef.current?.clientWidth ?? 1024) < 1024;
    const hasElement =
      !!editor.selectedId && editor.selectedId !== editor.document.rootId;
    if (
      hasElement ||
      (!compactLayout && editor.selectedId && selectionVersion > 0)
    ) {
      setPanelMode("inspector");
      if (!compactLayout) setPanelOpen(true);
    } else {
      setPanelMode("add");
      if (!compactLayout && !editor.selectedId) setPanelOpen(true);
    }
  }, [compact, editor.document.rootId, editor.selectedId, selectionVersion]);

  useEffect(() => {
    if (editor.document !== savedDocument.current) setStatus("Unsaved");
  }, [editor.document]);

  const capabilities = new Set<EditorCapability>([
    ...(editor.mode === "edit" ? (["edit"] as const) : []),
    ...(canSave ? (["save"] as const) : []),
    ...(canPublish ? (["publish"] as const) : []),
    ...(editor.builder.resources.size > 0 ? (["resources"] as const) : []),
  ]);
  const contributionContext: EditorContributionContext = {
    ...editor,
    capabilities,
  };
  const composition = createEditorComposition(preset, [
    ...builtInContributions({
      canPublish: canPublish && !lifecycleBlocked && !readOnly,
      canSave: canSave && !lifecycleBlocked && !readOnly,
      published: !!lifecycleState?.publishedRevisionId,
      pending: lifecycle
        ? lifecycleState?.pending === "save" ||
          lifecycleState?.pending === "publish"
          ? lifecycleState.pending
          : null
        : pending,
      status,
      onSave: () => void perform("save"),
      onPublish: () => void perform("publish"),
    }),
    ...contributions,
  ]);

  return (
    <section
      ref={editorRootRef}
      aria-label="Page builder"
      className={cn(
        "@container flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
      data-pagebldr-editor={editor.builder.namespace}
      data-pagebldr-document={editor.document.id}
      data-pagebldr-mode={editor.mode}
    >
      <EditorToolbar
        moreActionsRef={moreActionsRef}
        canSave={canSave && pending === null && !lifecycleBlocked && !readOnly}
        onHistory={() => setHistoryOpen(true)}
        canUnpublish={
          !!lifecycleState?.publishedRevisionId &&
          !lifecycleBlocked &&
          !readOnly
        }
        onUnpublish={() => setUnpublishOpen(true)}
        onSave={() => void perform("save")}
        panelOpen={panelOpen}
        onPanelOpenChange={(open) => {
          setPanelOpen(open);
          if (open && (editorRootRef.current?.clientWidth ?? 0) <= 600)
            setStructureOpen(false);
        }}
        onPageDesign={() => setPageDesignOpen(true)}
        structureOpen={structureOpen}
        onStructureOpenChange={(open) => {
          setStructureOpen(open);
          if (open && (editorRootRef.current?.clientWidth ?? 0) <= 600)
            setPanelOpen(false);
        }}
        status={status}
        start={
          editor.previewing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => editor.setPreviewing(false)}
            >
              Return to editor
            </Button>
          ) : (
            composition.render("toolbar.leading", contributionContext)
          )
        }
        end={
          editor.previewing
            ? null
            : composition.render("toolbar.trailing", contributionContext)
        }
      />
      <Separator />
      {editor.previewing ? (
        <div className="min-h-0 flex-1">
          <IsolatedCanvas />
        </div>
      ) : (
        <>
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <WorkspacePanels
              compact={compact}
              panel={
                panelOpen ? (
                  <aside
                    ref={panelOverlay.ref}
                    style={
                      compact
                        ? {
                            ...panelOverlay.style,
                          }
                        : { height: "100%" }
                    }
                    className="z-20 flex w-full shrink-0 flex-col border-r bg-background @max-[1024px]:absolute @max-[1024px]:bottom-auto @max-[1024px]:left-4 @max-[1024px]:top-4 @max-[1024px]:h-[min(42rem,calc(100%-6rem))] @max-[1024px]:w-[min(26rem,calc(100%-2rem))] @max-[600px]:w-[calc(100%-2rem)] @max-[1024px]:rounded-xl @max-[1024px]:border @max-[1024px]:shadow-xl"
                    aria-label={
                      panelMode === "add" ? "Add to page" : "Element inspector"
                    }
                  >
                    <div
                      className="flex min-h-14 items-center gap-2 border-b px-2 py-2 @max-[1024px]:cursor-move @max-[1024px]:touch-none"
                      onDoubleClick={(event) => {
                        if (!(event.target as HTMLElement).closest("button"))
                          panelOverlay.reset();
                      }}
                      onPointerDown={panelOverlay.beginMove}
                    >
                      {panelMode === "inspector" ? (
                        <Button
                          aria-label="Back to Add to page"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setPanelMode("add")}
                        >
                          <ChevronLeftIcon />
                        </Button>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold">
                          {panelMode === "add"
                            ? "Add to page"
                            : (editor.selected?.name ?? "Inspector")}
                        </h2>
                        <p className="truncate text-xs text-muted-foreground">
                          {panelMode === "add"
                            ? "Click or drag into the canvas"
                            : `${
                                editor.selected
                                  ? (editor.builder.elements.get(
                                      editor.selected.type,
                                    )?.label ?? editor.selected.type)
                                  : "Element"
                              }`}
                        </p>
                      </div>
                      {compact ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Hide editor panel"
                          onClick={() => setPanelOpen(false)}
                        >
                          <ChevronDownIcon />
                        </Button>
                      ) : null}
                    </div>
                    <div className="min-h-0 flex-1">
                      {panelMode === "add"
                        ? composition.render(
                            "sidebar.start",
                            contributionContext,
                          )
                        : composition.render(
                            "sidebar.end",
                            contributionContext,
                          )}
                    </div>
                  </aside>
                ) : null
              }
            >
              <section
                aria-label="Page canvas"
                className="relative h-full min-w-0 flex-1"
              >
                <IsolatedCanvas
                  compact={compact}
                  onElementContextMenu={(elementId, x, y) =>
                    setElementContext((current) => ({
                      elementId,
                      x,
                      y,
                      sequence: (current?.sequence ?? 0) + 1,
                    }))
                  }
                >
                  {composition.render("canvas.overlay", contributionContext)}
                </IsolatedCanvas>
                <StructureWindow
                  clipboard={clipboard}
                  open={structureOpen}
                  onClipboardChange={setClipboard}
                  onOpenChange={setStructureOpen}
                  onStyleClipboardChange={setStyleClipboard}
                  styleClipboard={styleClipboard}
                />
              </section>
            </WorkspacePanels>
            <CompactToolbar
              panelOpen={panelOpen}
              onPanelOpenChange={(open) => {
                setPanelOpen(open);
                if (open && (editorRootRef.current?.clientWidth ?? 0) <= 600)
                  setStructureOpen(false);
              }}
              structureOpen={structureOpen}
              onStructureOpenChange={(open) => {
                setStructureOpen(open);
                if (open && (editorRootRef.current?.clientWidth ?? 0) <= 600)
                  setPanelOpen(false);
              }}
            />
            <div className="sr-only" aria-live="polite">
              {composition.render("status", contributionContext)}
            </div>
          </div>
        </>
      )}
      {elementContext && editor.document.elements[elementContext.elementId] ? (
        <StructureMenu
          key={elementContext.elementId}
          elementId={elementContext.elementId}
          contextPoint={elementContext}
          onEdit={() => {
            setPanelMode("inspector");
            setPanelOpen(true);
          }}
          clipboard={clipboard}
          styleClipboard={styleClipboard}
          onCopy={setClipboard}
          onCopyStyles={setStyleClipboard}
        />
      ) : null}
      <PageDesignDialog
        open={pageDesignOpen}
        onOpenChange={setPageDesignOpen}
      />
      <HistorySheet
        restoreFocus={() => moreActionsRef.current?.focus()}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lifecycle={lifecycle}
        snapshot={lifecycleState}
      />
      {lifecycle && lifecycleState ? (
        <LifecycleDialogs
          lifecycle={lifecycle}
          snapshot={lifecycleState}
          unpublishOpen={unpublishOpen}
          onUnpublishOpenChange={setUnpublishOpen}
        />
      ) : null}
    </section>
  );
}

function builtInContributions(input: {
  readonly published: boolean;
  readonly canPublish: boolean;
  readonly canSave: boolean;
  readonly pending: "save" | "publish" | null;
  readonly status: string;
  readonly onSave: () => void;
  readonly onPublish: () => void;
}): readonly EditorContribution[] {
  return [
    defineEditorContribution({
      id: "pagebldr.history",
      kind: "toolbarAction",
      label: "History and viewport",
      render: HistoryControls,
    }),
    defineEditorContribution({
      id: "pagebldr.persistence",
      kind: "toolbarAction",
      label: "Save and publish",
      render: () => <PersistenceControls {...input} />,
    }),
    defineEditorContribution({
      id: "pagebldr.navigator",
      kind: "panel",
      label: "Navigator",
      render: LeftPanel,
    }),
    defineEditorContribution({
      id: "pagebldr.inspector",
      kind: "panel",
      label: "Inspector",
      render: Inspector,
    }),
    defineEditorContribution({
      id: "pagebldr.selection",
      kind: "statusItem",
      label: "Selection",
      render: ({ context }) => (
        <span>
          {context.document.elements[context.selectedId ?? ""]?.name ??
            "No selection"}
        </span>
      ),
    }),
    defineEditorContribution({
      id: "pagebldr.status",
      kind: "statusItem",
      label: "Operation status",
      render: () => (
        <span aria-live="polite" role="status">
          {input.status}
        </span>
      ),
    }),
  ];
}

function EditorToolbar({
  moreActionsRef,
  canSave,
  canUnpublish,
  onUnpublish,
  onPanelOpenChange,
  onPageDesign,
  onHistory,
  onSave,
  onStructureOpenChange,
  panelOpen,
  start,
  end,
  status,
  structureOpen,
}: {
  readonly moreActionsRef: React.RefObject<HTMLButtonElement | null>;
  readonly canSave: boolean;
  readonly canUnpublish: boolean;
  readonly onUnpublish: () => void;
  readonly onPanelOpenChange: (open: boolean) => void;
  readonly onPageDesign: () => void;
  readonly onHistory: () => void;
  readonly onSave: () => void;
  readonly onStructureOpenChange: (open: boolean) => void;
  readonly panelOpen: boolean;
  readonly start: ReactNode;
  readonly end: ReactNode;
  readonly status: string;
  readonly structureOpen: boolean;
}) {
  const editor = usePagebldrEditor();
  return (
    <header className="relative flex min-h-14 items-center gap-2 px-2">
      {!editor.previewing ? (
        <div className="@max-[1024px]:hidden">
          <ToolButton
            label={panelOpen ? "Close Add panel" : "Open Add panel"}
            onClick={() => onPanelOpenChange(!panelOpen)}
            icon={PanelLeftIcon}
          />
        </div>
      ) : null}
      <div className="flex min-w-0 max-w-80 items-center gap-3 px-1">
        <Input
          aria-label="Page title"
          className="h-8 min-w-0 border-0 bg-transparent px-2 text-sm font-semibold shadow-none focus-visible:ring-1"
          disabled={editor.mode !== "edit"}
          value={editor.document.title}
          onChange={(event) => {
            const title = event.currentTarget.value;
            if (title.trim())
              editor.dispatch({ type: "update-page", title }, "page-title");
          }}
        />
        <Badge variant="secondary" className="shrink-0">
          {status}
        </Badge>
      </div>
      {editor.previewing || editor.mode !== "edit" ? (
        <Badge className="@max-[1024px]:hidden" variant="secondary">
          {editor.previewing || editor.mode === "preview"
            ? "Preview"
            : "Read only"}
        </Badge>
      ) : null}
      <div
        className={cn(
          "flex flex-1 items-center justify-center",
          !editor.previewing && "@max-[1024px]:hidden",
        )}
      >
        {start}
      </div>
      {!editor.previewing ? (
        <>
          <Button
            className="@max-[1024px]:hidden"
            aria-label="Structure"
            title="Structure"
            size="icon-sm"
            variant={structureOpen ? "secondary" : "ghost"}
            onClick={() => onStructureOpenChange(!structureOpen)}
          >
            <Layers3Icon data-icon="inline-start" />
          </Button>
          <Button
            className="@max-[1024px]:hidden"
            aria-label="Preview"
            title="Preview"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.setPreviewing(true)}
          >
            <EyeIcon data-icon="inline-start" />
          </Button>
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{end}</div>
      {!editor.previewing ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={moreActionsRef}
              aria-label="More editor actions"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 border-0">
            <DropdownMenuLabel className="flex justify-between">
              Editor actions{" "}
              <span className="font-normal text-muted-foreground">
                {status}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={!editor.canUndo}
                onSelect={editor.undo}
              >
                <Undo2Icon /> Undo
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!editor.canRedo}
                onSelect={editor.redo}
              >
                <Redo2Icon /> Redo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => editor.setPreviewing(true)}>
                <EyeIcon /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onStructureOpenChange(!structureOpen)}
              >
                <Layers3Icon /> {structureOpen ? "Hide" : "Show"} Structure
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canSave} onSelect={onSave}>
                <SaveIcon /> Save draft
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onHistory}>
                <HistoryIcon />
                History
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onPageDesign}>
                <PaletteIcon /> Page design
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const root = moreActionsRef.current?.closest(
                    "[data-pagebldr-editor]",
                  );
                  requestAnimationFrame(() => {
                    const input = root?.querySelector<HTMLInputElement>(
                      'input[aria-label="Page title"]',
                    );
                    input?.focus();
                    input?.select();
                  });
                }}
              >
                <PencilIcon />
                Rename page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canUnpublish ? (
                <DropdownMenuItem variant="destructive" onSelect={onUnpublish}>
                  Unpublish
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}

function HistoryControls() {
  const editor = usePagebldrEditor();
  return (
    <div className="flex w-full items-center justify-end gap-1">
      <div className="absolute left-1/2 -translate-x-1/2">
        <ViewportToggle />
      </div>
      <ToolButton
        label="Undo"
        disabled={!editor.canUndo}
        onClick={editor.undo}
        icon={Undo2Icon}
      />
      <ToolButton
        label="Redo"
        disabled={!editor.canRedo}
        onClick={editor.redo}
        icon={Redo2Icon}
      />
    </div>
  );
}

function PersistenceControls({
  canSave,
  pending,
  onSave,
}: {
  readonly published: boolean;
  readonly canPublish: boolean;
  readonly canSave: boolean;
  readonly pending: "save" | "publish" | null;
  readonly onSave: () => void;
  readonly onPublish: () => void;
}) {
  return (
    <Button size="sm" disabled={!canSave || pending !== null} onClick={onSave}>
      <span className="relative -top-px leading-none">
        {pending === "save" ? "Updating?" : "Update"}
      </span>
    </Button>
  );
}

function CompactToolbar({
  onPanelOpenChange,
  onStructureOpenChange,
  panelOpen,
  structureOpen,
}: {
  readonly onPanelOpenChange: (open: boolean) => void;
  readonly onStructureOpenChange: (open: boolean) => void;
  readonly panelOpen: boolean;
  readonly structureOpen: boolean;
}) {
  const editor = usePagebldrEditor();
  const hasElement =
    !!editor.selectedId && editor.selectedId !== editor.document.rootId;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 hidden items-center justify-between px-3 @max-[1024px]:flex">
      <Button
        aria-label={
          panelOpen
            ? "Hide editor panel"
            : hasElement
              ? "Edit selected element"
              : "Add to page"
        }
        className="pointer-events-auto rounded-full shadow-lg"
        size="icon-lg"
        variant={panelOpen ? "secondary" : "outline"}
        onClick={() => onPanelOpenChange(!panelOpen)}
      >
        {hasElement ? <PencilIcon /> : <PlusIcon />}
      </Button>
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          aria-label={structureOpen ? "Close Structure" : "Open Structure"}
          className="rounded-full shadow-lg"
          size="icon-lg"
          variant={structureOpen ? "secondary" : "outline"}
          onClick={() => onStructureOpenChange(!structureOpen)}
        >
          <Layers3Icon />
        </Button>
        <CompactPageView />
      </div>
    </div>
  );
}

function CompactPageView() {
  const editor = usePagebldrEditor();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = [
    ["desktop", "Desktop", LaptopIcon],
    ["tablet", "Tablet", TabletIcon],
    ["mobile", "Mobile", SmartphoneIcon],
  ] as const;
  const desktop =
    editor.viewport === "desktop" || editor.viewport === "desktop-fill";
  const Icon = desktop
    ? LaptopIcon
    : editor.viewport === "tablet"
      ? TabletIcon
      : SmartphoneIcon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon-lg"
          variant="outline"
          className="rounded-full shadow-lg"
          ref={triggerRef}
          aria-label="Page view"
        >
          <Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 border-0">
        <p className="font-semibold">Page view</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the canvas size you want to edit.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {items.map(([value, label, ItemIcon]) => (
            <Button
              key={value}
              variant={
                (value === "desktop" ? desktop : editor.viewport === value)
                  ? "secondary"
                  : "outline"
              }
              aria-pressed={
                value === "desktop" ? desktop : editor.viewport === value
              }
              className="justify-start"
              onClick={() => {
                editor.setViewport(
                  value === "desktop" && desktop
                    ? editor.viewport === "desktop"
                      ? "desktop-fill"
                      : "desktop"
                    : value,
                );
                setOpen(false);
              }}
            >
              <ItemIcon data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start"
          onClick={() => {
            triggerRef.current
              ?.closest("[data-pagebldr-editor]")
              ?.dispatchEvent(new CustomEvent("pagebldr:reveal-selection"));
            setOpen(false);
          }}
        >
          Scroll to selection
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ToolButton({
  label,
  disabled,
  large = false,
  onClick,
  icon: Icon,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly large?: boolean;
  readonly onClick: () => void;
  readonly icon: typeof Undo2Icon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={large ? "size-11" : undefined}
          size={large ? "icon-lg" : "icon-sm"}
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ViewportToggle({ compact = false }: { readonly compact?: boolean }) {
  const editor = usePagebldrEditor();
  const dimensions = useCanvasDimensions();
  const desktopViewport =
    editor.viewport === "desktop-fill" ? "desktop-fill" : "desktop";
  const items: readonly [EditorViewport, string, typeof LaptopIcon][] = [
    [
      desktopViewport,
      desktopViewport === "desktop"
        ? "Desktop fixed; press again for full width"
        : "Desktop full width; press again for fixed width",
      LaptopIcon,
    ],
    ["tablet", "Tablet", TabletIcon],
    ["mobile", "Mobile", SmartphoneIcon],
  ];
  return (
    <ToggleGroup
      type="single"
      value={editor.viewport}
      onPointerEnter={dimensions.show}
      onPointerLeave={dimensions.hideSoon}
      onFocusCapture={dimensions.show}
      onBlurCapture={dimensions.hideSoon}
      onValueChange={(value) => {
        if (!value && editor.viewport === "desktop")
          editor.setViewport("desktop-fill");
        else if (!value && editor.viewport === "desktop-fill")
          editor.setViewport("desktop");
        else if (value) editor.setViewport(value as EditorViewport);
      }}
      variant="outline"
      size="sm"
    >
      {items.map(([value, label, Icon]) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          className={compact ? "size-11" : undefined}
        >
          <Icon />
          <span className="sr-only">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function LeftPanel() {
  return <LibraryPanel />;
}

function Inspector() {
  const editor = usePagebldrEditor();
  if (!editor.selected)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Element selected</EmptyTitle>
          <EmptyDescription>
            Select an Element on the canvas or in Structure.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  const element = editor.selected;
  const definition = editor.builder.elements.get(element.type);
  const elementStyleControls = (definition?.styleControls ?? []).filter(
    (control) => isPropertyControlVisible(control, element.props),
  );
  return (
    <Tabs defaultValue="properties" className="h-full gap-0">
      <TabsList
        variant="line"
        className="mx-3 mt-2 grid w-auto grid-cols-3 @max-[1024px]:min-h-11"
      >
        <TabsTrigger value="properties">Content</TabsTrigger>
        <TabsTrigger value="styles">Style</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="min-h-0">
        <ScrollArea className="h-full px-4 pt-4">
          <FieldGroup className="gap-5 pb-6">
            {element.type === "container" ? (
              <ContainerLayoutPresets element={element} />
            ) : null}
            {definition?.controls
              ?.filter(
                (control) =>
                  element.type !== "container" ||
                  !["tag", "layout"].includes(control.key),
              )
              .map((control) => (
                <PropertyField
                  key={control.key}
                  element={element}
                  control={control}
                  applicationDestinations={editor.applicationDestinations}
                />
              ))}
          </FieldGroup>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="styles" className="min-h-0">
        <ScrollArea className="h-full px-4 pt-4">
          {elementStyleControls.length ? (
            <>
              <FieldGroup className="gap-5 pb-5">
                {elementStyleControls.map((control) => (
                  <PropertyField
                    key={control.key}
                    element={element}
                    control={control}
                    applicationDestinations={editor.applicationDestinations}
                  />
                ))}
              </FieldGroup>
              <Separator className="mb-5" />
            </>
          ) : null}
          <StyleControls element={element} section="style" />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="advanced" className="min-h-0">
        <ScrollArea className="h-full px-4 pt-4">
          <FieldGroup className="gap-5 pb-6">
            <AnchorControl element={element} />
            {element.type === "container"
              ? definition?.controls
                  ?.filter((control) => ["tag", "layout"].includes(control.key))
                  .map((control) => (
                    <PropertyField
                      key={control.key}
                      element={element}
                      control={control}
                      applicationDestinations={editor.applicationDestinations}
                    />
                  ))
              : null}
            <Separator />
            <StyleControls element={element} section="advanced" />
          </FieldGroup>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function ContainerLayoutPresets({
  element,
}: {
  readonly element: PageElement;
}) {
  const editor = usePagebldrEditor();
  const breakpoint = styleBreakpointFromViewport(editor.viewport);
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Layout preset</FieldLabel>
        <Badge variant="outline">{breakpoint}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: "Vertical",
            icon: Rows3Icon,
            columns: 0,
            direction: "column",
          },
          {
            label: "Horizontal",
            icon: Columns2Icon,
            columns: 0,
            direction: "row",
          },
          {
            label: "2 columns",
            icon: Grid2X2Icon,
            columns: 2,
            direction: "row",
          },
          {
            label: "3 columns",
            icon: Columns3Icon,
            columns: 3,
            direction: "row",
          },
        ].map(({ label, icon: Icon, columns, direction }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            className="h-16 flex-col gap-1.5"
            disabled={editor.mode !== "edit" || element.locked}
            onClick={() => {
              let styles = replaceStyleProperties(
                element.styles,
                breakpoint,
                "normal",
                ["display"],
                columns ? "grid" : "flex",
              );
              styles = replaceStyleProperties(
                styles,
                breakpoint,
                "normal",
                ["gridTemplateColumns"],
                columns ? `repeat(${columns}, minmax(0, 1fr))` : null,
              );
              if (!columns)
                styles = replaceStyleProperties(
                  styles,
                  breakpoint,
                  "normal",
                  ["flexDirection"],
                  direction,
                );
              editor.dispatch({
                type: "replace-styles",
                elementId: element.id,
                styles,
              });
            }}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>
      <FieldDescription>
        Presets only change this device and undo in one step.
      </FieldDescription>
    </Field>
  );
}

function PropertyField({
  applicationDestinations,
  element,
  control,
}: {
  readonly applicationDestinations: readonly ApplicationDestinationOption[];
  readonly element: PageElement;
  readonly control: ElementControl<Record<string, unknown>>;
}) {
  const editor = usePagebldrEditor();
  const id = useId();
  const value = element.props[control.key];
  const label = propertyControlLabel(control, element.props);
  if (!isPropertyControlVisible(control, element.props)) return null;
  if (control.kind === "media")
    return <MediaControl element={element} control={control} />;
  const description = control.description ? (
    <FieldDescription>{control.description}</FieldDescription>
  ) : null;
  const update = (nextValue: unknown) => {
    if (Object.is(value, nextValue)) return;
    editor.dispatch(
      {
        type: "update-props",
        elementId: element.id,
        patch: { [control.key]: nextValue },
      },
      `prop:${element.id}:${control.key}`,
    );
  };

  if (control.kind === "collection")
    return (
      <CollectionControl
        applicationDestinations={applicationDestinations}
        control={{ ...control, label }}
        disabled={editor.mode !== "edit" || element.locked}
        document={editor.document}
        elementId={element.id}
        value={value}
        onChange={update}
      />
    );

  if (control.kind === "rich-text")
    return (
      <RichTextControl
        control={{ ...control, label }}
        disabled={editor.mode !== "edit" || element.locked}
        value={value}
        onChange={update}
      />
    );

  if (control.kind === "destination")
    return (
      <DestinationControl
        applicationDestinations={applicationDestinations}
        control={{ ...control, label }}
        disabled={editor.mode !== "edit" || element.locked}
        document={editor.document}
        elementId={element.id}
        value={value}
        onChange={update}
      />
    );

  if (control.kind === "boolean")
    return (
      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {description}
        </div>
        <Switch
          id={id}
          checked={value === true}
          disabled={editor.mode !== "edit" || element.locked}
          onCheckedChange={update}
        />
      </Field>
    );

  if (control.kind === "select") {
    const selected = control.options.find(
      ({ value: option }) => option === value,
    );
    if (control.presentation && control.presentation !== "select")
      return (
        <Field>
          <FieldLabel id={id}>{label}</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={selected ? String(selected.value) : ""}
            onValueChange={(nextValue) => {
              const option = control.options.find(
                ({ value: candidate }) => String(candidate) === nextValue,
              );
              if (option) update(option.value);
            }}
            disabled={editor.mode !== "edit" || element.locked}
            aria-labelledby={id}
            className="w-full"
          >
            {control.options.map((option) => {
              const Icon = propertyOptionIcon(
                control.presentation,
                option.value,
              );
              return (
                <ToggleGroupItem
                  key={`${typeof option.value}:${option.value}`}
                  value={String(option.value)}
                  className="flex-1"
                  aria-label={option.label}
                  title={option.label}
                >
                  {Icon ? <Icon data-icon="inline-start" /> : option.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {description}
        </Field>
      );
    return (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <NativeSelect
          id={id}
          value={selected ? String(selected.value) : ""}
          disabled={editor.mode !== "edit" || element.locked}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            const option = control.options.find(
              ({ value: candidate }) => String(candidate) === nextValue,
            );
            if (option) update(option.value);
          }}
        >
          {!selected ? (
            <NativeSelectOption value="" disabled>
              Select {control.label.toLowerCase()}
            </NativeSelectOption>
          ) : null}
          {control.options.map((option) => (
            <NativeSelectOption
              key={`${typeof option.value}:${option.value}`}
              value={String(option.value)}
            >
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {description}
      </Field>
    );
  }

  if (typeof value !== "string" && typeof value !== "number") return null;
  if (
    control.kind === "text" &&
    control.presentation === "color" &&
    typeof value === "string"
  )
    return (
      <ColorField
        label={label}
        value={value}
        disabled={editor.mode !== "edit" || element.locked}
        allowAlpha={control.allowAlpha ?? true}
        onCommit={update}
      >
        {description}
      </ColorField>
    );
  if (
    control.kind === "number" &&
    control.presentation === "slider" &&
    typeof value === "number" &&
    control.min !== undefined &&
    control.max !== undefined
  )
    return (
      <SliderField
        key={`${element.id}:${control.key}`}
        label={label}
        value={value}
        min={control.min}
        max={control.max}
        {...(control.step !== undefined ? { step: control.step } : {})}
        {...(control.unit !== undefined ? { unit: control.unit } : {})}
        disabled={editor.mode !== "edit" || element.locked}
        onCommit={update}
      >
        {description}
      </SliderField>
    );
  const isDateTime =
    control.kind === "text" && control.presentation === "datetime";
  return (
    <ValidatedInputField
      key={`${element.id}:${control.key}`}
      label={label}
      value={isDateTime ? formatLocalDateTime(String(value)) : String(value)}
      commitOnBlur={isDateTime}
      multiline={control.kind === "text" && control.presentation === "textarea"}
      inputProps={{
        type: isDateTime
          ? "datetime-local"
          : control.kind === "number"
            ? "number"
            : "text",
        min: control.kind === "number" ? control.min : undefined,
        max: control.kind === "number" ? control.max : undefined,
        step: isDateTime
          ? "0.001"
          : control.kind === "number"
            ? control.step
            : undefined,
        placeholder: control.kind === "text" ? control.placeholder : undefined,
        disabled: editor.mode !== "edit" || element.locked,
      }}
      onCommit={(draft) =>
        update(
          control.kind === "number"
            ? parseNumberDraft(draft, control.min, control.max)
            : isDateTime
              ? parseLocalDateTime(draft)
              : draft,
        )
      }
    >
      {description}
      {isDateTime ? (
        <p className="text-xs text-muted-foreground">
          Uses your local time zone.
        </p>
      ) : null}
    </ValidatedInputField>
  );
}

export function isPropertyControlVisible(
  control: ElementControl<Record<string, unknown>>,
  props: Readonly<Record<string, unknown>>,
): boolean {
  if (!control.visibleWhen) return true;
  const conditions = isVisibilityConditionArray(control.visibleWhen)
    ? control.visibleWhen
    : [control.visibleWhen];
  return conditions.every(
    (condition) =>
      (condition.equals === undefined ||
        props[condition.key] === condition.equals) &&
      (condition.notEquals === undefined ||
        props[condition.key] !== condition.notEquals),
  );
}

function isVisibilityConditionArray(
  value:
    | ElementControlVisibilityCondition<Record<string, unknown>>
    | readonly ElementControlVisibilityCondition<Record<string, unknown>>[],
): value is readonly ElementControlVisibilityCondition<
  Record<string, unknown>
>[] {
  return Array.isArray(value);
}

function keyboardMoveDirection(key: string) {
  if (key === "ArrowUp") return "up" as const;
  if (key === "ArrowDown") return "down" as const;
  if (key === "ArrowRight") return "in" as const;
  if (key === "ArrowLeft") return "out" as const;
  return null;
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, textarea, select, [role='textbox']"))
  );
}
