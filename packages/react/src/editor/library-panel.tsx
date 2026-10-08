"use client";

import { useEffect, useRef, useState } from "react";
import { startBlockDrag, endBlockDrag } from "./block-drag.js";
import {
  PlusIcon,
  StarIcon,
  EyeIcon,
  Trash2Icon,
  PencilIcon,
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
import { Input } from "../components/ui/input.js";
import { ScrollArea } from "../components/ui/scroll-area.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs.js";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import { usePagebldrEditor, useLibraryBrowsing } from "./context.js";
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
  pagebldrElementDragType,
} from "./canvas-placement.js";
import {
  materializeBlock,
  materializeTemplate,
  thumbnailForeground,
} from "./library-model.js";
import { PagebldrRenderer } from "../renderer.js";
import { PagebldrRuntimeInteractions } from "../runtime-interactions.js";

type LibraryEntry = BlockDefinition | TemplateDefinition;
export function LibraryPanel() {
  const editor = usePagebldrEditor();
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
    (!favouritesOnly || favourites.includes(entry.key));
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
          <Input
            id="pb-library-search"
            placeholder="Search elements, blocks, templates…"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
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
        <TabsList className="mx-3 grid w-auto grid-cols-3">
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
                .map((definition) => (
                  <Button
                    key={definition.type}
                    variant="outline"
                    className="h-auto min-h-16 flex-col"
                    disabled={readOnly}
                    draggable={!readOnly}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(
                        pagebldrElementDragType,
                        definition.type,
                      );
                    }}
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
                    <PlusIcon data-icon="inline-start" />
                    {definition.label}
                  </Button>
                ))}
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
                    <FieldLabel>Category</FieldLabel>
                    <InspectorSelect
                      aria-label="Library category"
                      value={category}
                      onChange={(event) =>
                        setCategory(event.currentTarget.value)
                      }
                    >
                      <InspectorSelectOption value="all">
                        All categories
                      </InspectorSelectOption>
                      {categories.map((item) => (
                        <InspectorSelectOption key={item} value={item}>
                          {item.replaceAll("-", " ")}
                        </InspectorSelectOption>
                      ))}
                    </InspectorSelect>
                  </Field>
                </FieldGroup>
                <Button
                  variant="outline"
                  aria-pressed={favouritesOnly}
                  onClick={() => setFavouritesOnly(!favouritesOnly)}
                >
                  <StarIcon data-icon="inline-start" />
                  Favourites only
                </Button>
                {loading ? <p role="status">Loading library…</p> : null}
                {error ? <p role="alert">{error}</p> : null}
                {entries.filter(matches).map((entry) => {
                  const savedBlock = saved.includes(entry as BlockDefinition);
                  const managedTemplate = managed.includes(
                    entry as TemplateDefinition,
                  );
                  return (
                    <Card
                      key={`${value}:${savedBlock || managedTemplate ? "host" : "package"}:${entry.key}`}
                      className="gap-3 py-3"
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
                      <CardHeader className="gap-2 px-3">
                        <div
                          className="pb-library-thumbnail"
                          style={{
                            backgroundColor:
                              entry.thumbnail?.accent ?? "var(--muted)",
                            color: thumbnailForeground(entry.thumbnail?.accent),
                          }}
                        >
                          <span>
                            {entry.thumbnail?.eyebrow ??
                              entry.category ??
                              value}
                          </span>
                          <strong>
                            {entry.thumbnail?.summary ?? entry.label}
                          </strong>
                        </div>
                        <CardTitle>{entry.label}</CardTitle>
                        <CardDescription>
                          {entry.description ??
                            (savedBlock ? "Saved block" : "Host template")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Favourite ${entry.label}`}
                          aria-pressed={favourites.includes(entry.key)}
                          onClick={() => favourite(entry.key)}
                        >
                          <StarIcon data-icon="inline-start" />
                          Favourite
                        </Button>
                      </CardContent>
                      <CardFooter className="flex-wrap gap-2 px-3">
                        <Button
                          size="sm"
                          disabled={readOnly || pending}
                          onClick={() =>
                            void (value === "blocks"
                              ? insert(entry as BlockDefinition)
                              : apply(entry as TemplateDefinition))
                          }
                        >
                          {value === "blocks"
                            ? "Insert block"
                            : "Apply template"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          aria-label={`Preview ${entry.label}`}
                          onClick={() =>
                            void openPreview(entry, value === "blocks")
                          }
                        >
                          <EyeIcon data-icon="inline-start" />
                          Preview
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
        <DialogContent className="pb-library-preview">
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
