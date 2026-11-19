"use client";

import { useRef, useState, type ReactNode } from "react";
import { createId, type PageDocument, type PageElement } from "@pagebldr/core";
import type { PagebldrEditorProps } from "../index.js";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CopyIcon,
  Trash2Icon,
  PlusIcon,
  PencilIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip.js";
import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldError,
} from "../components/ui/field.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu.js";
import { Switch } from "../components/ui/switch.js";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog.js";
import {
  usePagebldrEditor,
  PanelEditingScope,
  PanelEditingActions,
} from "./context.js";
import { ValidatedInputField } from "./validated-input-field.js";
import { createElementClipboard } from "./canvas-placement.js";
import { usePanelDialogResize } from "./panel-dialog-resize.js";

export function PanelContentControl({
  element,
  renderEditor,
}: {
  readonly element: PageElement;
  readonly renderEditor: (props: PagebldrEditorProps) => ReactNode;
}) {
  const editor = usePagebldrEditor();
  const resize = usePanelDialogResize();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{
    rootId: string;
    base: PageDocument;
    draft: PageDocument;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = editor.mode !== "edit" || element.locked;
  const group =
    element.type === "content-tabs" || element.type === "content-accordion";
  const panelType =
    element.type === "content-accordion" ? "accordion-panel" : "tab-panel";
  const close = () => {
    resize.cancelGesture();
    setSession(null);
  };
  const open = (id: string) => {
    setError(null);
    setSession({ rootId: id, base: editor.document, draft: editor.document });
  };
  const save = () => {
    if (!session) return;
    try {
      const invalid =
        dialogRef.current?.parentElement?.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        );
      if (invalid) {
        invalid.focus();
        throw new Error("Correct the invalid field before saving.");
      }
      if (
        session.draft !== session.base &&
        editor.builder.documents.serialize(session.draft) !==
          editor.builder.documents.serialize(session.base)
      )
        editor.dispatch({
          type: "apply-subtree",
          elementId: session.rootId,
          baseDocument: session.base,
          document: session.draft,
        });
      close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save panel content.",
      );
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  const panels = group
    ? element.children.map((id) => editor.document.elements[id]!)
    : [];
  return (
    <>
      {group ? (
        <FieldSet className="gap-3">
          <FieldLegend variant="label">
            {panelType === "tab-panel" ? "Tabs" : "Answers"}
          </FieldLegend>
          {panels.map((panel, index) => {
            const key = panel.type === "tab-panel" ? "label" : "question";
            const locked = disabled || panel.locked;
            if (panelType === "tab-panel")
              return (
                <div
                  key={panel.id}
                  className="flex min-w-0 items-center gap-1 rounded-lg border px-2 py-2"
                >
                  <span
                    className="w-5 shrink-0 text-center text-xs text-muted-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 [&_[data-slot=field-label]]:sr-only">
                    <ValidatedInputField
                      value={String(panel.props.label)}
                      label={`Tab label ${index + 1}`}
                      inputProps={{ disabled: locked }}
                      commitOnBlur
                      onCommit={(value) =>
                        editor.dispatch({
                          type: "update-props",
                          elementId: panel.id,
                          patch: { label: value },
                        })
                      }
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={locked}
                        aria-label={`Edit with canvas: ${String(panel.props.label)}`}
                        onClick={() => open(panel.id)}
                      >
                        <PencilIcon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit content</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={locked}
                        aria-label={`Actions for tab ${index + 1}`}
                      >
                        <MoreHorizontalIcon aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          disabled={index === 0}
                          onSelect={() =>
                            editor.dispatch({
                              type: "move",
                              elementId: panel.id,
                              parentId: element.id,
                              index: index - 1,
                            })
                          }
                        >
                          <ArrowUpIcon aria-hidden="true" />
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index === panels.length - 1}
                          onSelect={() =>
                            editor.dispatch({
                              type: "move",
                              elementId: panel.id,
                              parentId: element.id,
                              index: index + 1,
                            })
                          }
                        >
                          <ArrowDownIcon aria-hidden="true" />
                          Move down
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={panels.length >= 12}
                          onSelect={() =>
                            editor.dispatch({
                              type: "duplicate",
                              elementId: panel.id,
                            })
                          }
                        >
                          <CopyIcon aria-hidden="true" />
                          Duplicate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            editor.dispatch({
                              type: "remove",
                              elementId: panel.id,
                            })
                          }
                        >
                          <Trash2Icon aria-hidden="true" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            return (
              <FieldSet key={panel.id} className="gap-3 rounded-lg border p-3">
                <ValidatedInputField
                  value={String(panel.props[key])}
                  label={`${key === "label" ? "Tab label" : "Question"} ${index + 1}`}
                  inputProps={{ disabled: locked }}
                  commitOnBlur
                  onCommit={(value) =>
                    editor.dispatch({
                      type: "update-props",
                      elementId: panel.id,
                      patch: { [key]: value },
                    })
                  }
                />
                {panelType === "accordion-panel" ? (
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor={`panel-default-${panel.id}`}>
                      Open by default
                    </FieldLabel>
                    <Switch
                      id={`panel-default-${panel.id}`}
                      disabled={locked}
                      checked={panel.props.defaultOpen === true}
                      onCheckedChange={(value) =>
                        editor.dispatch({
                          type: "update-props",
                          elementId: panel.id,
                          patch: { defaultOpen: value },
                        })
                      }
                    />
                  </Field>
                ) : null}
                <Button
                  variant="outline"
                  disabled={locked}
                  aria-label={`Edit with canvas: ${String(panel.props[key])}`}
                  onClick={() => open(panel.id)}
                >
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Edit content
                  <span className="sr-only">: {String(panel.props[key])}</span>
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move panel ${index + 1} up`}
                        disabled={locked || index === 0}
                        onClick={() =>
                          editor.dispatch({
                            type: "move",
                            elementId: panel.id,
                            parentId: element.id,
                            index: index - 1,
                          })
                        }
                      >
                        <ArrowUpIcon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Move up</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move panel ${index + 1} down`}
                        disabled={locked || index === panels.length - 1}
                        onClick={() =>
                          editor.dispatch({
                            type: "move",
                            elementId: panel.id,
                            parentId: element.id,
                            index: index + 1,
                          })
                        }
                      >
                        <ArrowDownIcon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Move down</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Duplicate panel ${index + 1}`}
                        disabled={locked || panels.length >= 30}
                        onClick={() =>
                          editor.dispatch({
                            type: "duplicate",
                            elementId: panel.id,
                          })
                        }
                      >
                        <CopyIcon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate panel</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove panel ${index + 1}`}
                        disabled={locked}
                        onClick={() =>
                          editor.dispatch({
                            type: "remove",
                            elementId: panel.id,
                          })
                        }
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove panel</TooltipContent>
                  </Tooltip>
                </div>
              </FieldSet>
            );
          })}
          <Button
            variant="outline"
            disabled={
              disabled || panels.length >= (panelType === "tab-panel" ? 12 : 30)
            }
            onClick={() => {
              const definition = editor.builder.elements.get(panelType)!;
              const clipboard = createElementClipboard(definition);
              const item = clipboard.elements[clipboard.rootId]!;
              const key = panelType === "tab-panel" ? "label" : "question";
              const label = `${panelType === "tab-panel" ? "Tab" : "Question"} ${panels.length + 1}`;
              editor.dispatch({
                type: "insert",
                parentId: element.id,
                index: panels.length,
                clipboard: {
                  ...clipboard,
                  elements: {
                    ...clipboard.elements,
                    [item.id]: {
                      ...item,
                      name: label,
                      props: { ...item.props, [key]: label },
                    },
                  },
                },
              });
            }}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {panelType === "tab-panel" ? "Add tab" : "Add answer"}
          </Button>
          {panelType === "tab-panel" && panels.length > 0 ? (
            <Field>
              <FieldLabel htmlFor={`default-tab-${element.id}`}>
                Default tab
              </FieldLabel>
              <InspectorSelect
                id={`default-tab-${element.id}`}
                value={
                  (
                    panels.find(
                      (panel) =>
                        !panel.hidden && panel.props.defaultOpen === true,
                    ) ?? panels.find((panel) => !panel.hidden)
                  )?.id ?? ""
                }
                disabled={disabled || panels.every((panel) => panel.hidden)}
                onChange={(event) => {
                  const draft = chooseDefaultTab(
                    editor.document,
                    element.id,
                    event.currentTarget.value,
                  );
                  if (draft === editor.document) return;
                  editor.dispatch({
                    type: "apply-subtree",
                    elementId: element.id,
                    baseDocument: editor.document,
                    document: draft,
                  });
                }}
              >
                {panels
                  .filter((panel) => !panel.hidden)
                  .map((panel) => (
                    <InspectorSelectOption
                      key={panel.id}
                      value={panel.id}
                      disabled={panels.some(
                        (other) =>
                          other.locked &&
                          (other.props.defaultOpen === true) !==
                            (other.id === panel.id),
                      )}
                    >
                      {String(panel.props.label)}
                    </InspectorSelectOption>
                  ))}
              </InspectorSelect>
            </Field>
          ) : null}
        </FieldSet>
      ) : element.id !== editor.rootId ? (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => open(element.id)}
        >
          Edit with canvas
        </Button>
      ) : null}
      <Dialog
        open={session !== null}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          style={resize.style}
          data-pagebldr-panel-resizing={resize.active || undefined}
          className="pagebldr-panel-canvas-dialog translate-x-0 translate-y-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (resize.cancelGesture()) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              (!event.defaultPrevented || !isTextInput(event.target)) &&
              event.target instanceof Element &&
              event.target.closest('[role="dialog"]') === event.currentTarget
            ) {
              event.preventDefault();
              event.stopPropagation();
              close();
              return;
            }
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "s"
            ) {
              event.preventDefault();
              const active = event.currentTarget.ownerDocument.activeElement;
              if (active instanceof HTMLElement) active.blur();
              window.setTimeout(() => saveRef.current(), 0);
            }
          }}
        >
          <div ref={dialogRef} className="sr-only">
            <DialogTitle>Edit panel content</DialogTitle>
            <DialogDescription>
              {session
                ? String(
                    session.base.elements[session.rootId]!.props.label ??
                      session.base.elements[session.rootId]!.props.question,
                  )
                : ""}
            </DialogDescription>
          </div>
          {error ? (
            <FieldError className="px-3" role="alert">
              {error}
            </FieldError>
          ) : null}
          {session ? (
            <PanelEditingScope.Provider value={session.rootId}>
              <PanelEditingActions.Provider value={{ save, cancel: close }}>
                {renderEditor({
                  builder: editor.builder,
                  document: session.draft,
                  className: "h-full min-h-0",
                  mode: editor.mode,
                  onChange: (event) =>
                    setSession((current) =>
                      current ? { ...current, draft: event.document } : current,
                    ),
                  ...(editor.elementRenderers
                    ? { elementRenderers: editor.elementRenderers }
                    : {}),
                  ...(editor.resources ? { resources: editor.resources } : {}),
                  ...(editor.librarySource
                    ? { librarySource: editor.librarySource }
                    : {}),
                  applicationDestinations: editor.applicationDestinations,
                  ...(editor.resolveApplicationDestination
                    ? {
                        resolveApplicationDestination:
                          editor.resolveApplicationDestination,
                      }
                    : {}),
                })}
              </PanelEditingActions.Provider>
            </PanelEditingScope.Provider>
          ) : null}
          {resize.handle}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Explicit upgrade keeps existing text Tabs authored content and identity. */
export function convertTextTabs(
  document: PageDocument,
  elementId: string,
  defaults: Readonly<Record<string, unknown>>,
): PageDocument {
  const element = document.elements[elementId]!;
  const elements = { ...document.elements };
  const items = element.props.items as readonly {
    label: string;
    content: string;
  }[];
  const children = items.map((item, index) => {
    const id = createId("element");
    const textId = createId("element");
    elements[id] = {
      ...element,
      id,
      type: "tab-panel",
      name: item.label,
      props: { label: item.label, defaultOpen: index === 0 },
      elementVersion: 1,
      children: [textId],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
    elements[textId] = {
      ...elements[id],
      id: textId,
      type: "rich-text",
      name: "Rich Text",
      props: { content: [{ type: "paragraph", text: item.content }] },
      children: [],
    };
    return id;
  });
  elements[elementId] = {
    ...element,
    type: "content-tabs",
    props: {
      ...defaults,
      ...(element.props.anchorId ? { anchorId: element.props.anchorId } : {}),
    },
    children,
  };
  return { ...document, elements };
}

function isTextInput(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.matches('input, textarea, select, [contenteditable="true"]')
  );
}

// Choosing one default preserves panel identities and commits as one history step.
export function chooseDefaultTab(
  document: PageDocument,
  elementId: string,
  panelId: string,
): PageDocument {
  const tabs = document.elements[elementId];
  if (
    tabs?.type !== "content-tabs" ||
    tabs.locked ||
    !tabs.children.includes(panelId) ||
    document.elements[panelId]?.hidden
  )
    return document;
  const elements = { ...document.elements };
  let changed = false;
  for (const id of tabs.children) {
    const panel = elements[id]!;
    const defaultOpen = id === panelId;
    if (panel.props.defaultOpen === defaultOpen) continue;
    if (panel.locked) return document;
    elements[id] = { ...panel, props: { ...panel.props, defaultOpen } };
    changed = true;
  }
  return changed ? { ...document, elements } : document;
}
