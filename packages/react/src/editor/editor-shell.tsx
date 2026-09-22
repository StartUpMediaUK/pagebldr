"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent,
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
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  LaptopIcon,
  LockIcon,
  PlusIcon,
  Redo2Icon,
  SaveIcon,
  SendIcon,
  SmartphoneIcon,
  TabletIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";

import type { PagebldrClipboard, PageElement } from "@pagebldr/core";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable.js";
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

import { PagebldrRenderer, type PagebldrEditorProps } from "../index.js";
import { PagebldrRuntimeInteractions } from "../runtime-interactions.js";
import {
  EditorProvider,
  usePagebldrEditor,
  type EditorViewport,
} from "./context.js";
import { standardEditorPreset } from "./presets.js";

export function EditorShell(props: PagebldrEditorProps) {
  return (
    <EditorProvider
      builder={props.builder}
      document={props.document}
      mode={props.mode ?? "edit"}
      onChange={props.onChange}
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
}: PagebldrEditorProps) {
  const editor = usePagebldrEditor();
  const [pending, setPending] = useState<"save" | "publish" | null>(null);
  const [status, setStatus] = useState("Ready");
  const readOnly = editor.mode !== "edit";

  const perform = useCallback(
    async (kind: "save" | "publish") => {
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
        setStatus(kind === "save" ? "Saved" : "Published");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : `${kind} failed`);
      } finally {
        setPending(null);
      }
    },
    [editor.document, onPublish, onSave],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      }
      if (modifier && event.key.toLowerCase() === "s" && onSave) {
        event.preventDefault();
        void perform("save");
      }
      if (
        event.key === "Delete" &&
        editor.selectedId &&
        editor.selectedId !== editor.document.rootId &&
        !readOnly
      ) {
        event.preventDefault();
        editor.dispatch({ type: "remove", elementId: editor.selectedId });
        editor.select(editor.document.rootId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, onSave, perform, readOnly]);

  const capabilities = new Set<EditorCapability>([
    ...(editor.mode === "edit" ? (["edit"] as const) : []),
    ...(onSave ? (["save"] as const) : []),
    ...(onPublish ? (["publish"] as const) : []),
    ...(editor.builder.resources.size > 0 ? (["resources"] as const) : []),
  ]);
  const contributionContext: EditorContributionContext = {
    ...editor,
    capabilities,
  };
  const composition = createEditorComposition(preset, [
    ...builtInContributions({
      canPublish: !!onPublish,
      canSave: !!onSave,
      pending,
      status,
      onSave: () => void perform("save"),
      onPublish: () => void perform("publish"),
    }),
    ...contributions,
  ]);

  return (
    <section
      aria-label="Page builder"
      className={cn(
        "flex h-[min(900px,100vh)] min-h-[640px] flex-col overflow-hidden rounded-lg border bg-background text-foreground",
        className,
      )}
      data-pagebldr-editor={editor.builder.namespace}
      data-pagebldr-document={editor.document.id}
      data-pagebldr-mode={editor.mode}
    >
      <EditorToolbar
        start={composition.render("toolbar.leading", contributionContext)}
        end={composition.render("toolbar.trailing", contributionContext)}
      />
      <Separator />
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={22} minSize={16}>
          {composition.render("sidebar.start", contributionContext)}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={56} minSize={32}>
          <Canvas>
            {composition.render("canvas.overlay", contributionContext)}
          </Canvas>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={22} minSize={18}>
          {composition.render("sidebar.end", contributionContext)}
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="flex h-8 items-center justify-between gap-2 border-t px-3 text-xs text-muted-foreground">
        {composition.render("status", contributionContext)}
      </div>
    </section>
  );
}

function builtInContributions(input: {
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
  start,
  end,
}: {
  readonly start: ReactNode;
  readonly end: ReactNode;
}) {
  const editor = usePagebldrEditor();
  return (
    <header className="flex h-12 items-center gap-2 px-2">
      <strong className="truncate px-2 text-sm">{editor.document.title}</strong>
      <Badge variant="secondary">{editor.mode}</Badge>
      {start}
      <div className="flex-1" />
      {end}
    </header>
  );
}

function HistoryControls() {
  const editor = usePagebldrEditor();
  return (
    <div className="flex items-center gap-2">
      <ViewportToggle />
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
  canPublish,
  canSave,
  pending,
  onSave,
  onPublish,
}: {
  readonly canPublish: boolean;
  readonly canSave: boolean;
  readonly pending: "save" | "publish" | null;
  readonly onSave: () => void;
  readonly onPublish: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!canSave || pending !== null}
        onClick={onSave}
      >
        <SaveIcon data-icon="inline-start" />
        {pending === "save" ? "Saving…" : "Save"}
      </Button>
      <Button
        size="sm"
        disabled={!canPublish || pending !== null}
        onClick={onPublish}
      >
        <SendIcon data-icon="inline-start" />
        {pending === "publish" ? "Publishing…" : "Publish"}
      </Button>
    </div>
  );
}

function ToolButton({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly icon: typeof Undo2Icon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          size="icon-sm"
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

function ViewportToggle() {
  const editor = usePagebldrEditor();
  const items: readonly [EditorViewport, string, typeof LaptopIcon][] = [
    ["desktop", "Desktop", LaptopIcon],
    ["tablet", "Tablet", TabletIcon],
    ["mobile", "Mobile", SmartphoneIcon],
  ];
  return (
    <ToggleGroup
      type="single"
      value={editor.viewport}
      onValueChange={(value) =>
        value && editor.setViewport(value as EditorViewport)
      }
      variant="outline"
      size="sm"
    >
      {items.map(([value, label, Icon]) => (
        <ToggleGroupItem key={value} value={value} aria-label={label}>
          <Icon />
          <span className="sr-only">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function LeftPanel() {
  return (
    <Tabs defaultValue="structure" className="h-full gap-0">
      <TabsList className="m-2 grid w-auto grid-cols-2">
        <TabsTrigger value="structure">Structure</TabsTrigger>
        <TabsTrigger value="add">Add</TabsTrigger>
      </TabsList>
      <TabsContent value="structure" className="min-h-0">
        <ScrollArea className="h-full px-2">
          <StructureTree />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="add" className="min-h-0">
        <ScrollArea className="h-full px-2">
          <ElementLibrary />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function StructureTree() {
  const editor = usePagebldrEditor();
  const render = (id: string, depth: number): React.ReactNode => {
    const element = editor.document.elements[id]!;
    return (
      <div key={id} className="flex flex-col gap-1">
        <Button
          variant={editor.selectedId === id ? "secondary" : "ghost"}
          className="w-full justify-start"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => editor.select(id)}
        >
          {element.hidden ? (
            <EyeIcon data-icon="inline-start" />
          ) : element.locked ? (
            <LockIcon data-icon="inline-start" />
          ) : null}
          <span className="truncate">{element.name}</span>
        </Button>
        {element.children.map((child) => render(child, depth + 1))}
      </div>
    );
  };
  return (
    <div
      className="flex flex-col gap-1 pb-4"
      role="tree"
      aria-label="Page structure"
    >
      {render(editor.document.rootId, 0)}
    </div>
  );
}

function ElementLibrary() {
  const editor = usePagebldrEditor();
  const add = (type: string) => {
    const definition = editor.builder.elements.get(type)!;
    const temporaryId = `new-${type}`;
    const element: PageElement = {
      id: temporaryId,
      type,
      elementVersion: definition.version,
      name: definition.label,
      props: definition.defaults() as Readonly<Record<string, unknown>>,
      children: [],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
    const clipboard: PagebldrClipboard = {
      format: "pagebldr-clipboard",
      schemaVersion: 1,
      rootId: temporaryId,
      elements: { [temporaryId]: element },
      classes: {},
      classOrder: [],
      variables: {},
      variableOrder: [],
    };
    const parentId = editor.selected?.children
      ? editor.selected.id
      : editor.document.rootId;
    editor.dispatch({
      type: "insert",
      parentId,
      index: editor.document.elements[parentId]!.children.length,
      clipboard,
    });
  };
  return (
    <div className="grid grid-cols-2 gap-2 pb-4">
      {[...editor.builder.elements.values()].map((definition) => (
        <Button
          key={definition.type}
          variant="outline"
          className="h-auto min-h-16 flex-col"
          disabled={editor.mode !== "edit"}
          onClick={() => add(definition.type)}
        >
          <PlusIcon data-icon="inline-start" />
          {definition.label}
        </Button>
      ))}
    </div>
  );
}

function Canvas({ children }: { readonly children?: ReactNode }) {
  const editor = usePagebldrEditor();
  const widths = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;
  const select = (event: MouseEvent<HTMLDivElement>) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-pagebldr-element]")
        : null;
    if (target?.dataset.pagebldrElement)
      editor.select(target.dataset.pagebldrElement);
  };
  return (
    <div
      className="relative h-full overflow-auto bg-muted p-4"
      onClick={select}
    >
      {children ? (
        <div className="pointer-events-none absolute inset-0">{children}</div>
      ) : null}
      <div
        className="mx-auto min-h-full overflow-hidden rounded-md border bg-background shadow-sm transition-[width]"
        style={{ width: widths[editor.viewport], maxWidth: "100%" }}
      >
        <PagebldrRuntimeInteractions />
        <PagebldrRenderer
          builder={editor.builder}
          document={editor.document}
          mode={editor.mode === "edit" ? "edit" : "preview"}
        />
      </div>
    </div>
  );
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
  const readOnly = editor.mode !== "edit";
  return (
    <Tabs defaultValue="properties" className="h-full gap-0">
      <TabsList className="m-2 grid w-auto grid-cols-2">
        <TabsTrigger value="properties">Properties</TabsTrigger>
        <TabsTrigger value="styles">Styles</TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="min-h-0">
        <ScrollArea className="h-full px-3">
          <FieldGroup className="pb-6">
            <Field>
              <FieldLabel htmlFor="pb-element-name">Name</FieldLabel>
              <Input
                id="pb-element-name"
                value={element.name}
                disabled={readOnly}
                onChange={(event) =>
                  editor.dispatch(
                    {
                      type: "rename",
                      elementId: element.id,
                      name: event.currentTarget.value,
                    },
                    `name:${element.id}`,
                  )
                }
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="pb-hidden">Hidden</FieldLabel>
              <Switch
                id="pb-hidden"
                checked={element.hidden}
                disabled={readOnly}
                onCheckedChange={(hidden) =>
                  editor.dispatch({
                    type: "set-hidden",
                    elementId: element.id,
                    hidden,
                  })
                }
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="pb-locked">Locked</FieldLabel>
              <Switch
                id="pb-locked"
                checked={element.locked}
                disabled={readOnly}
                onCheckedChange={(locked) =>
                  editor.dispatch({
                    type: "set-locked",
                    elementId: element.id,
                    locked,
                  })
                }
              />
            </Field>
            {definition?.controls?.map((control) => (
              <PropertyField
                key={control.key}
                element={element}
                control={control}
              />
            ))}
            <ElementActions />
          </FieldGroup>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="styles" className="min-h-0">
        <ScrollArea className="h-full px-3">
          <FieldGroup className="pb-6">
            <Field>
              <FieldLabel>Breakpoint</FieldLabel>
              <FieldDescription>
                Styles are edited at the active {editor.viewport} breakpoint.
              </FieldDescription>
            </Field>
            {(definition?.styles ?? []).map((capability) => (
              <div key={capability} className="rounded-md border p-3">
                <strong className="text-sm">
                  {editor.builder.styles.capabilities.get(capability)?.label ??
                    capability}
                </strong>
              </div>
            ))}
            <Separator />
            <Field>
              <FieldLabel>Classes</FieldLabel>
              <FieldDescription>
                {element.classIds.length
                  ? element.classIds.join(", ")
                  : "No reusable Classes assigned."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Variables</FieldLabel>
              <FieldDescription>
                {editor.document.variableOrder.length} design Variables
                available.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function PropertyField({
  element,
  control,
}: {
  readonly element: PageElement;
  readonly control: { readonly key: string; readonly label: string };
}) {
  const editor = usePagebldrEditor();
  const id = useId();
  const value = element.props[control.key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{control.label}</FieldLabel>
      <Input
        id={id}
        value={String(value)}
        disabled={editor.mode !== "edit"}
        onChange={(event) =>
          editor.dispatch(
            {
              type: "update-props",
              elementId: element.id,
              patch: {
                [control.key]:
                  typeof value === "number"
                    ? Number(event.currentTarget.value)
                    : event.currentTarget.value,
              },
            },
            `prop:${element.id}:${control.key}`,
          )
        }
      />
    </Field>
  );
}

function ElementActions() {
  const editor = usePagebldrEditor();
  const element = editor.selected!;
  const index = editor.builder.documents.index(editor.document);
  const parentId = index.parentById.get(element.id);
  const position = index.indexById.get(element.id) ?? 0;
  const siblingCount = parentId
    ? (editor.document.elements[parentId]?.children.length ?? 0)
    : 0;
  const disabled = editor.mode !== "edit" || !parentId;
  return (
    <Field>
      <FieldLabel>Actions</FieldLabel>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || position === 0}
          onClick={() =>
            editor.dispatch({
              type: "move",
              elementId: element.id,
              parentId: parentId!,
              index: position - 1,
            })
          }
        >
          <ArrowUpIcon data-icon="inline-start" />
          Move up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || position >= siblingCount - 1}
          onClick={() =>
            editor.dispatch({
              type: "move",
              elementId: element.id,
              parentId: parentId!,
              index: position + 1,
            })
          }
        >
          <ArrowDownIcon data-icon="inline-start" />
          Move down
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled}
          onClick={() => {
            editor.dispatch({ type: "remove", elementId: element.id });
            editor.select(editor.document.rootId);
          }}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </Field>
  );
}
