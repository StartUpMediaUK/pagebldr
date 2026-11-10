"use client";

import { useEffect, useRef, useState } from "react";
import { startBlockDrag, endBlockDrag } from "./block-drag.js";
import {
  BoxIcon,
  BadgeIcon,
  Building2Icon,
  ChartNoAxesColumnIncreasingIcon,
  CircleHelpIcon,
  CopyrightIcon,
  GaugeIcon,
  HeadingIcon,
  ImageIcon,
  ImagesIcon,
  ListIcon,
  ListChecksIcon,
  MenuIcon,
  MousePointerClickIcon,
  PanelsTopLeftIcon,
  PilcrowIcon,
  QuoteIcon,
  SeparatorHorizontalIcon,
  Share2Icon,
  SpaceIcon,
  TimerIcon,
  VideoIcon,
  type LucideIcon,
  StarIcon,
  EyeIcon,
  Trash2Icon,
  PencilIcon,
  PlusIcon,
  PackageOpenIcon,
  SearchIcon,
} from "lucide-react";
import {
  resolveDocumentResources,
  type BlockDefinition,
  type TemplateDefinition,
  type PageDocument,
  type PreparedResources,
} from "@pagebldr/core";
import { standardBlocks } from "@pagebldr/core/library";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "../components/ui/empty.js";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field.js";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../components/ui/input-group.js";
import { ScrollArea } from "../components/ui/scroll-area.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs.js";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import {
  usePagebldrEditor,
  useLibraryBrowsing,
  useElementDragSession,
} from "./context.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog.js";
import {
  createElementClipboard,
  resolveClickInsertion,
} from "./canvas-placement.js";
import {
  materializeBlock,
  materializeTemplate,
  thumbnailForeground,
} from "./library-model.js";
import { PagebldrRenderer } from "../renderer.js";
import { PagebldrRuntimeInteractions } from "../runtime-interactions.js";

type LibraryEntry = BlockDefinition | TemplateDefinition;
// Private presentation for the standard library. Host Elements retain a
// neutral fallback; this does not add UI dependencies to core definitions.
const elementIcons: Readonly<Record<string, LucideIcon>> = {
  container: BoxIcon,
  heading: HeadingIcon,
  "rich-text": PilcrowIcon,
  button: MousePointerClickIcon,
  logo: BadgeIcon,
  menu: MenuIcon,
  copyright: CopyrightIcon,
  image: ImageIcon,
  video: VideoIcon,
  icon: StarIcon,
  divider: SeparatorHorizontalIcon,
  spacer: SpaceIcon,
  list: ListIcon,
  "icon-list": ListChecksIcon,
  accordion: CircleHelpIcon,
  tabs: PanelsTopLeftIcon,
  testimonial: QuoteIcon,
  "star-rating": StarIcon,
  counter: GaugeIcon,
  progress: ChartNoAxesColumnIncreasingIcon,
  countdown: TimerIcon,
  "social-links": Share2Icon,
  "logo-cloud": Building2Icon,
  "gallery-carousel": ImagesIcon,
};
export function LibraryPanel() {
  const editor = usePagebldrEditor();
  const elementDrag = useElementDragSession();
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const browsing = useLibraryBrowsing();
  const { query, tab, category, templateSource, favouritesOnly } =
    browsing.value;
  const setQuery = (query: string) =>
    browsing.update((value) => ({ ...value, query }));
  const setTab = (tab: string) =>
    browsing.update((value) => ({ ...value, tab }));
  const setCategory = (category: string) =>
    browsing.update((value) => ({ ...value, category }));
  const setTemplateSource = (templateSource: string) =>
    browsing.update((value) => ({ ...value, templateSource }));
  const setFavouritesOnly = (favouritesOnly: boolean) =>
    browsing.update((value) => ({ ...value, favouritesOnly }));
  const [deleting, setDeleting] = useState<{
    entry: LibraryEntry;
    block: boolean;
  } | null>(null);
  const [saved, setSaved] = useState<readonly BlockDefinition[]>([]);
  const [managed, setManaged] = useState<readonly TemplateDefinition[]>([]);
  const [favourites, setFavourites] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const previewOpener = useRef<HTMLButtonElement | null>(null);
  const [preview, setPreview] = useState<{
    entry: LibraryEntry;
    document: PageDocument;
    resources: PreparedResources;
    block: boolean;
  } | null>(null);
  const readOnly = editor.mode !== "edit" || editor.previewing;

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(
          `pagebldr:${editor.builder.namespace}:favourites`,
        ) ?? "[]",
      );
      if (Array.isArray(value) && value.every((key) => typeof key === "string"))
        setFavourites(value);
    } catch {
      /* Preferences are optional. */
    }
  }, [editor.builder.namespace]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      editor.librarySource?.listBlocks?.(controller.signal) ?? [],
      editor.librarySource?.listTemplates?.(controller.signal) ?? [],
    ])
      .then(([blocks, templates]) => {
        if (!controller.signal.aborted) {
          setSaved(blocks);
          setManaged(templates);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load the library.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [editor.librarySource, editor.libraryVersion]);
  const customBlocks = [...editor.builder.blocks.values()];
  const blocks = [
    ...standardBlocks.filter((item) => !editor.builder.blocks.has(item.key)),
    ...customBlocks,
    ...saved,
  ];
  const featured = [...editor.builder.templates.values()];
  const templates =
    managed.length && templateSource === "managed"
      ? managed
      : featured.length
        ? featured
        : managed;
  const entries = tab === "blocks" ? blocks : templates;
  const categories = [
    ...new Set(entries.map((entry) => entry.category ?? "other")),
  ];
  const matches = (entry: LibraryEntry) =>
    [entry.label, entry.description, entry.category, ...(entry.tags ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()) &&
    (category === "all" || entry.category === category) &&
    (tab !== "templates" || !favouritesOnly || favourites.includes(entry.key));
  const perform = async (action: () => void | Promise<void>) => {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Library action failed.",
      );
    } finally {
      setPending(false);
    }
  };
  const insert = (entry: BlockDefinition) =>
    perform(async () => {
      const destination = editor.document;
      let clipboard = materializeBlock(editor.builder, entry.create());
      clipboard =
        (await editor.librarySource?.adaptBlockReferences?.(
          clipboard,
          new AbortController().signal,
        )) ?? clipboard;
      if (
        editorRef.current.document !== destination ||
        editorRef.current.mode !== "edit"
      )
        throw new Error(
          "The Document changed while adapting references. Please insert again.",
        );
      clipboard = editor.builder.editor.library.prepareBlock(
        clipboard,
        editor.document,
      );
      const placement = resolveClickInsertion({
        document: editor.document,
        definitions: editor.builder.elements,
        selectedId: editor.selectedId,
        elementType: clipboard.elements[clipboard.rootId]!.type,
      });
      if (!placement)
        throw new Error(
          "No valid insertion target. Select an unlocked container.",
        );
      editor.dispatch({
        type: "insert",
        parentId: placement.parentId,
        index: placement.index,
        clipboard,
      });
      editor.select(clipboard.rootId);
    });
  const apply = (entry: TemplateDefinition) =>
    perform(async () => {
      const destination = editor.document;
      let template = materializeTemplate(editor.builder, entry.create());
      template =
        (await editor.librarySource?.adaptTemplateReferences?.(
          template,
          new AbortController().signal,
        )) ?? template;
      if (
        editorRef.current.document !== destination ||
        editorRef.current.mode !== "edit"
      )
        throw new Error(
          "The Document changed while adapting references. Please apply again.",
        );
      template = editor.builder.editor.library.cloneTemplate(template);
      editor.dispatch({ type: "apply-template", template });
      editor.select(editor.document.rootId);
      editor.fitCanvas();
      setPreview(null);
    });
  const openPreview = (entry: LibraryEntry, block: boolean) =>
    perform(async () => {
      let document: PageDocument;
      if (block) {
        const empty = editor.builder.documents.create({ id: "block-preview" });
        const clipboard = editor.builder.editor.library.prepareBlock(
          materializeBlock(
            editor.builder,
            entry.create() as ReturnType<BlockDefinition["create"]>,
          ),
          empty,
        );
        document = editor.builder.editor.dispatch(empty, {
          type: "insert",
          parentId: empty.rootId,
          index: 0,
          clipboard,
        }).document;
      } else
        document = materializeTemplate(
          editor.builder,
          entry.create() as ReturnType<TemplateDefinition["create"]>,
        );
      const validation = editor.builder.documents.validate(document);
      if (!validation.valid) throw validation.error;
      const resources = await resolveDocumentResources(
        editor.builder,
        document,
      );
      setPreview({ entry, document, resources, block });
    });
  const favourite = (key: string) => {
    const next = favourites.includes(key)
      ? favourites.filter((item) => item !== key)
      : [...favourites, key];
    setFavourites(next);
    try {
      localStorage.setItem(
        `pagebldr:${editor.builder.namespace}:favourites`,
        JSON.stringify(next),
      );
    } catch {
      /* Session-only fallback. */
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col" data-pagebldr-library>
      <FieldGroup className="p-3">
        <Field>
          <FieldLabel htmlFor="pb-library-search" className="sr-only">
            Search library
          </FieldLabel>
          <InputGroup className="h-auto">
            <InputGroupInput
              id="pb-library-search"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setCategory("all");
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList variant="line" className="mx-3 grid w-auto grid-cols-3">
          <TabsTrigger value="elements">Elements</TabsTrigger>
          <TabsTrigger value="blocks">Blocks</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="elements" className="min-h-0">
          <ScrollArea className="h-full p-3">
            <div className="grid grid-cols-2 gap-2">
              {[...editor.builder.elements.values()]
                .filter((definition) =>
                  definition.label
                    .toLowerCase()
                    .includes(query.trim().toLowerCase()),
                )
                .map((definition) => {
                  const Icon = elementIcons[definition.type] ?? BoxIcon;
                  return (
                    <Button
                      key={definition.type}
                      variant="secondary"
                      className="h-20 flex-col"
                      disabled={readOnly}
                      draggable={!readOnly}
                      onDragStart={(event) => {
                        elementDrag.start(event.dataTransfer, {
                          kind: "element",
                          elementType: definition.type,
                        });
                      }}
                      onDragEnd={() => elementDrag.end()}
                      onClick={() => {
                        const placement = resolveClickInsertion({
                          document: editor.document,
                          definitions: editor.builder.elements,
                          selectedId: editor.selectedId,
                          elementType: definition.type,
                        });
                        if (placement)
                          editor.dispatch({
                            type: "insert",
                            parentId: placement.parentId,
                            index: placement.index,
                            clipboard: createElementClipboard(definition),
                          });
                      }}
                    >
                      <Icon data-icon="inline-start" />
                      {definition.label}
                    </Button>
                  );
                })}
            </div>
          </ScrollArea>
        </TabsContent>
        {(["blocks", "templates"] as const).map((value) => (
          <TabsContent key={value} value={value} className="min-h-0">
            <ScrollArea className="h-full p-3">
              <div className="flex flex-col gap-3">
                {value === "templates" &&
                managed.length > 0 &&
                featured.length > 0 ? (
                  <Tabs
                    value={templateSource}
                    onValueChange={(next) => {
                      setTemplateSource(next);
                      setCategory("all");
                    }}
                  >
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="featured">
                        Featured templates
                      </TabsTrigger>
                      <TabsTrigger value="managed">My templates</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
                <FieldGroup>
                  <Field>
                    <FieldLabel className="sr-only">Category</FieldLabel>
                    <InspectorSelect
                      aria-label="Library category"
                      value={
                        value === "templates" && favouritesOnly
                          ? "favourites"
                          : category
                      }
                      onChange={(event) => {
                        const next = event.currentTarget.value;
                        setFavouritesOnly(next === "favourites");
                        setCategory(next === "favourites" ? "all" : next);
                      }}
                    >
                      <InspectorSelectOption value="all">
                        All {value === "blocks" ? "block" : "template"}{" "}
                        categories
                      </InspectorSelectOption>
                      {value === "templates" ? (
                        <InspectorSelectOption value="favourites">
                          Favourites
                        </InspectorSelectOption>
                      ) : null}
                      {categories.map((item) => (
                        <InspectorSelectOption key={item} value={item}>
                          {item.replaceAll("-", " ")}
                        </InspectorSelectOption>
                      ))}
                    </InspectorSelect>
                  </Field>
                </FieldGroup>
                {loading ? <p role="status">Loading library…</p> : null}
                {error ? <p role="alert">{error}</p> : null}
                {entries
                  .filter(matches)
                  .filter(
                    (entry) =>
                      value !== "blocks" ||
                      !saved.includes(entry as BlockDefinition),
                  )
                  .map((entry) => {
                    const savedBlock = saved.includes(entry as BlockDefinition);
                    const managedTemplate = managed.includes(
                      entry as TemplateDefinition,
                    );
                    return (
                      <Card
                        key={`${value}:${savedBlock || managedTemplate ? "host" : "package"}:${entry.key}`}
                        data-library-key={entry.key}
                        draggable={value === "blocks" && !readOnly && !pending}
                        onDragStart={(event) => {
                          if (value === "blocks")
                            startBlockDrag(
                              event.dataTransfer,
                              materializeBlock(
                                editor.builder,
                                entry.create() as ReturnType<
                                  BlockDefinition["create"]
                                >,
                              ),
                            );
                        }}
                        onDragEnd={endBlockDrag}
                      >
                        <CardContent className="pt-3">
                          <div
                            aria-hidden="true"
                            className="pb-library-thumbnail border"
                            style={{
                              backgroundColor:
                                entry.thumbnail?.accent ?? "var(--muted)",
                              color: thumbnailForeground(
                                entry.thumbnail?.accent,
                              ),
                            }}
                          >
                            <span className="font-semibold">
                              {entry.thumbnail?.eyebrow ??
                                entry.category ??
                                value}
                            </span>
                            <strong>
                              {value === "templates"
                                ? entry.label
                                : (entry.thumbnail?.summary ?? entry.label)}
                            </strong>
                          </div>
                        </CardContent>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle>{entry.label}</CardTitle>
                            {value === "templates" ? (
                              <Button
                                size="icon-sm"
                                variant={
                                  favourites.includes(entry.key)
                                    ? "secondary"
                                    : "ghost"
                                }
                                aria-label={`Favourite ${entry.label}`}
                                aria-pressed={favourites.includes(entry.key)}
                                onClick={() => favourite(entry.key)}
                              >
                                <StarIcon data-icon="inline-start" />
                              </Button>
                            ) : null}
                          </div>
                          <CardDescription>
                            {entry.description ??
                              (savedBlock ? "Saved block" : "Host template")}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            disabled={
                              pending || (value === "blocks" && readOnly)
                            }
                            aria-label={
                              value === "templates"
                                ? `Preview ${entry.label}`
                                : undefined
                            }
                            onClick={(event) => {
                              previewOpener.current = event.currentTarget;
                              void (value === "blocks"
                                ? insert(entry as BlockDefinition)
                                : openPreview(entry, false));
                            }}
                          >
                            {value === "blocks" ? (
                              <PlusIcon data-icon="inline-start" />
                            ) : (
                              <EyeIcon data-icon="inline-start" />
                            )}
                            {value === "blocks" ? "Insert block" : "Preview"}
                          </Button>
                          {(savedBlock && editor.librarySource?.deleteBlock) ||
                          (managedTemplate &&
                            editor.librarySource?.deleteTemplate) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={readOnly || pending}
                              aria-label={`Delete ${entry.label}`}
                              onClick={() =>
                                setDeleting({ entry, block: savedBlock })
                              }
                            >
                              <Trash2Icon data-icon="inline-start" />
                            </Button>
                          ) : null}
                          {managedTemplate &&
                          editor.librarySource?.editTemplate ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={readOnly}
                              aria-label={`Edit ${entry.label}`}
                              onClick={() =>
                                editor.librarySource?.editTemplate?.(entry.key)
                              }
                            >
                              <PencilIcon data-icon="inline-start" />
                            </Button>
                          ) : null}
                        </CardFooter>
                      </Card>
                    );
                  })}
                {value === "blocks" && saved.some(matches) ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground px-1 text-xs font-medium">
                      Saved blocks
                    </p>
                    {saved.filter(matches).map((entry) => (
                      <div
                        key={entry.key}
                        className="flex items-center gap-1 rounded-lg border p-1"
                        data-library-key={entry.key}
                        draggable={!readOnly && !pending}
                        onDragStart={(event) =>
                          startBlockDrag(
                            event.dataTransfer,
                            materializeBlock(editor.builder, entry.create()),
                          )
                        }
                        onDragEnd={endBlockDrag}
                      >
                        <Button
                          className="h-auto min-w-0 flex-1 justify-start px-3 py-2"
                          variant="ghost"
                          disabled={readOnly || pending}
                          onClick={() => void insert(entry)}
                        >
                          <PackageOpenIcon data-icon="inline-start" />
                          <span className="truncate">{entry.label}</span>
                        </Button>
                        {editor.librarySource?.deleteBlock ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={readOnly || pending}
                            aria-label={`Delete saved block ${entry.label}`}
                            onClick={() => setDeleting({ entry, block: true })}
                          >
                            <Trash2Icon data-icon="inline-start" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!loading && !entries.filter(matches).length ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No {value} found</EmptyTitle>
                      <EmptyDescription>
                        {value === "templates"
                          ? "Templates are supplied by your Host. Try another search or ask your Host for access."
                          : "Try another search or category."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.entry.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Host library entry. Elements already inserted
              into this Document are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting)
                  void perform(async () => {
                    if (deleting.block)
                      await editor.librarySource?.deleteBlock?.(
                        deleting.entry.key,
                        new AbortController().signal,
                      );
                    else
                      await editor.librarySource?.deleteTemplate?.(
                        deleting.entry.key,
                        new AbortController().signal,
                      );
                    editor.refreshLibrary();
                  });
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent
          className="pb-library-preview"
          onCloseAutoFocus={(event) => {
            if (previewOpener.current?.isConnected) {
              event.preventDefault();
              previewOpener.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{preview?.entry.label ?? "Preview"}</DialogTitle>
            <DialogDescription>
              Read-only preview. Nothing is applied until you choose the action
              below.
            </DialogDescription>
          </DialogHeader>
          <div className="pb-library-preview-document">
            {preview ? (
              <>
                <PagebldrRuntimeInteractions />
                <PagebldrRenderer
                  builder={editor.builder}
                  document={preview.document}
                  resources={preview.resources}
                  mode="preview"
                />
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close preview
            </Button>
            <Button
              disabled={readOnly || pending}
              onClick={() => {
                if (preview)
                  void (preview.block
                    ? insert(preview.entry as BlockDefinition)
                    : apply(preview.entry as TemplateDefinition));
              }}
            >
              {preview?.block ? "Insert block" : "Apply template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
