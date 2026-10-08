"use client";
import { PdfPreview } from "./pdf-preview.js";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EyeIcon, UploadIcon, XIcon } from "lucide-react";
import {
  createMediaUploadQueue,
  detectExternalMediaKind,
  resourceKey,
  selectMediaItem,
  resolveMediaVideoEmbed,
  type MediaItem,
  type MediaKind,
  type MediaUploadQueue,
  type ResourceAdapter,
  type ResourceReference,
  type Pagebldr,
  type MediaBrowseOptions,
} from "@pagebldr/core";
import { Button } from "../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
} from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs.js";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import { useOptionalPagebldrEditor } from "./context.js";
import { cn } from "../lib/utils.js";

const queues = new WeakMap<ResourceAdapter, MediaUploadQueue>();
const emptyEntries: ReturnType<MediaUploadQueue["snapshot"]> = [];
const noopSubscribe = () => () => {};
function queueFor(
  adapter: ResourceAdapter | undefined,
): MediaUploadQueue | null {
  if (!adapter?.media) return null;
  let queue = queues.get(adapter);
  if (!queue) {
    queue = createMediaUploadQueue(adapter.media);
    queues.set(adapter, queue);
  }
  return queue;
}
export function safeMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  try {
    return ["https:", "http:", "blob:"].includes(new URL(url).protocol)
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}
export function MediaViewer({
  item,
  onClose,
}: {
  readonly item: MediaItem | null;
  readonly onClose: () => void;
}) {
  const url = safeMediaUrl(item?.url);
  const videoEmbed =
    item?.kind === "video" && url ? resolveMediaVideoEmbed(url) : null;
  const extension =
    item?.originalName?.split(".").pop()?.toLowerCase() ??
    item?.url?.split("?")[0]?.split(".").pop()?.toLowerCase();
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="pb-media-viewer">
        <DialogHeader>
          <DialogTitle>{item?.displayName ?? "Media viewer"}</DialogTitle>
          <DialogDescription>
            {item?.available
              ? "Preview media without changing selection."
              : "This media is unavailable and cannot be selected."}
          </DialogDescription>
        </DialogHeader>
        <div className="pb-media-viewer-content">
          {item?.available && url ? (
            item.kind === "image" ? (
              <img src={url} alt={item.displayName} />
            ) : item.kind === "video" ? (
              videoEmbed ? (
                <iframe
                  title={`${item.displayName} video preview`}
                  src={videoEmbed}
                  allow="fullscreen; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              ) : (
                <video src={url} controls preload="metadata" />
              )
            ) : item.kind === "audio" ? (
              <>
                <div className="pb-media-waveform" aria-hidden="true">
                  ▂ ▄ ▆ █ ▆ ▄ ▂ ▅ ▇ ▃ ▅ ▂
                </div>
                <audio src={url} controls preload="metadata" />
              </>
            ) : extension === "pdf" ? (
              <PdfPreview url={url} name={item.displayName} />
            ) : ["txt", "csv"].includes(extension ?? "") && item.text ? (
              <pre>{item.text.slice(0, 100_000)}</pre>
            ) : (
              <p>Download this document to view it.</p>
            )
          ) : (
            <p role="status">Media unavailable.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close viewer
          </Button>
          {url ? (
            <Button asChild>
              <a href={url} download target="_blank" rel="noopener noreferrer">
                Download
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MediaPickerProps {
  readonly builder?: Pagebldr;
  readonly readOnly?: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly allowed: readonly MediaKind[];
  readonly maximum?: number;
  readonly label: string;
  readonly existing?: readonly ResourceReference[];
  readonly excluded?: readonly ResourceReference[];
  readonly onCommit: (items: readonly MediaItem[]) => void;
}
export function MediaPicker({
  builder: suppliedBuilder,
  readOnly: suppliedReadOnly,
  open,
  onOpenChange,
  allowed,
  maximum = 1,
  label,
  existing = [],
  excluded = [],
  onCommit,
}: MediaPickerProps) {
  const editor = useOptionalPagebldrEditor();
  const builder = suppliedBuilder ?? editor?.builder;
  if (!builder)
    throw new Error("MediaPicker needs a builder or PagebldrEditor context.");
  const readOnly =
    suppliedReadOnly ?? (editor ? editor.mode !== "edit" : false);
  const adapters = [...builder.resources].filter(([, value]) => value.media);
  const [adapterKind, setAdapterKind] = useState(adapters[0]?.[0] ?? "");
  const adapter = builder.resources.get(adapterKind);
  const queue = useMemo(() => queueFor(adapter), [adapter]);
  const entries = useSyncExternalStore(
    queue?.subscribe ?? noopSubscribe,
    queue?.snapshot ?? (() => emptyEntries),
    () => emptyEntries,
  );
  const [items, setItems] = useState<readonly MediaItem[]>([]);
  const [selected, setSelected] = useState<readonly MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("masonry");
  const [tab, setTab] = useState("gallery");
  const [addingExternal, setAddingExternal] = useState(false);
  const [external, setExternal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 900, height: 400 });
  const [galleryNode, setGalleryNode] = useState<HTMLDivElement | null>(null);
  const consumed = useRef(new Set<string>());
  const initialized = useRef(false);
  const selectionTouched = useRef(false);
  const requestVersion = useRef(0);
  const browseController = useRef<AbortController | null>(null);
  const externalController = useRef<AbortController | null>(null);
  const id = useId();
  const excludedKeys = new Set(excluded.map(resourceKey));
  const selectedKeys = new Set(
    selected.map((item) => resourceKey(item.reference)),
  );
  const load = async (cursor?: string) => {
    if (!adapter?.browse || !adapter.media) return;
    const version = ++requestVersion.current;
    browseController.current?.abort();
    const controller = new AbortController();
    browseController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await adapter.browse(
        {
          query,
          ...(cursor ? { cursor } : {}),
          media: {
            allowed,
            sort: sort as MediaBrowseOptions["sort"],
            ...(kind !== "all" ? { kind: kind as MediaKind } : {}),
            ...(source !== "all"
              ? { source: source as "uploaded" | "external" }
              : {}),
          },
        },
        { signal: controller.signal },
      );
      if (version !== requestVersion.current) return;
      const described = result.items.map(adapter.media.describe);
      setItems((previous) => {
        const unique = new Map(
          (cursor ? [...previous, ...described] : described).map((item) => [
            resourceKey(item.reference),
            item,
          ]),
        );
        return [...unique.values()];
      });
      setNextCursor(result.nextCursor);
      if (!initialized.current && !selectionTouched.current) {
        setSelected((previous) =>
          previous.length
            ? previous
            : described
                .filter(
                  (item) =>
                    item.available &&
                    allowed.includes(item.kind) &&
                    existing.some(
                      (reference) =>
                        resourceKey(reference) === resourceKey(item.reference),
                    ),
                )
                .slice(0, maximum),
        );
        initialized.current = true;
      }
    } catch (failure) {
      if (version === requestVersion.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not browse media.",
        );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (!open) {
      requestVersion.current++;
      initialized.current = false;
      setSelected([]);
      setViewer(null);
      return;
    }
    consumed.current = new Set(
      queue
        ?.snapshot()
        .filter((entry) => entry.status === "complete")
        .map((entry) => entry.id),
    );
    setError(null);
    setExternal("");
    setSelected([]);
    initialized.current = false;
    selectionTouched.current = false;
    const controller = new AbortController();
    void Promise.all(
      existing.map((reference) =>
        Promise.resolve(
          builder.resources
            .get(reference.kind)
            ?.media?.lookup?.(reference, { signal: controller.signal }) ?? null,
        ),
      ),
    )
      .then((values) => {
        if (!controller.signal.aborted && !selectionTouched.current)
          setSelected((previous) =>
            values.reduce(
              (pending, item) =>
                item && !excludedKeys.has(resourceKey(item.reference))
                  ? selectMediaItem(pending, item, allowed, maximum)
                  : pending,
              previous,
            ),
          );
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load existing media.",
          );
      });
    return () => {
      controller.abort();
      requestVersion.current++;
      browseController.current?.abort();
      externalController.current?.abort();
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      setScrollTop(0);
      if (galleryNode) galleryNode.scrollTop = 0;
      setItems([]);
      setNextCursor(undefined);
      void load();
    }
    return () => {
      requestVersion.current++;
      browseController.current?.abort();
    };
  }, [open, adapter, query, kind, source, sort]);
  useEffect(() => {
    if (!open) return;
    const completed = entries.filter(
      (entry) =>
        entry.status === "complete" &&
        entry.item &&
        !consumed.current.has(entry.id),
    );
    if (!completed.length) return;
    selectionTouched.current = true;
    completed.forEach((entry) => consumed.current.add(entry.id));
    setSelected((previous) =>
      completed.reduce(
        (values, entry) =>
          excludedKeys.has(resourceKey(entry.item!.reference))
            ? values
            : selectMediaItem(values, entry.item!, allowed, maximum),
        previous,
      ),
    );
  }, [entries, open]);
  useEffect(() => {
    if (!open || !galleryNode) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(galleryNode);
    return () => observer.disconnect();
  }, [open, tab, galleryNode]);
  const allItems = new Map(
    items.map((item) => [resourceKey(item.reference), item]),
  );
  entries.forEach((entry) => {
    if (entry.item) allItems.set(resourceKey(entry.item.reference), entry.item);
  });
  const filtered = [...allItems.values()]
    .filter(
      (item) =>
        allowed.includes(item.kind) &&
        (kind === "all" || item.kind === kind) &&
        (source === "all" || item.source === source) &&
        [item.displayName, item.originalName, item.url]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name-asc"
        ? a.displayName.localeCompare(b.displayName)
        : sort === "name-desc"
          ? b.displayName.localeCompare(a.displayName)
          : sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
  const columns =
    view === "list"
      ? 1
      : dimensions.width >= 850
        ? 5
        : dimensions.width >= 550
          ? 3
          : 2;
  const rowHeight = view === "list" ? 100 : 230;
  const firstRow = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) -
      Math.ceil(dimensions.height / rowHeight / 2),
  );
  const rowCount = Math.ceil((dimensions.height / rowHeight) * 2) + 2;
  const virtual = view !== "masonry";
  const visible = virtual
    ? filtered.slice(firstRow * columns, (firstRow + rowCount) * columns)
    : filtered;
  const choose = (item: MediaItem) => {
    selectionTouched.current = true;
    const key = resourceKey(item.reference);
    if (excludedKeys.has(key)) return;
    setSelected((previous) =>
      previous.some((value) => resourceKey(value.reference) === key)
        ? previous.filter((value) => resourceKey(value.reference) !== key)
        : selectMediaItem(previous, item, allowed, maximum),
    );
  };
  const uploadFiles = async (files: FileList | readonly File[] | null) => {
    if (readOnly || !files || !queue || !adapter?.media?.upload) return;
    setError(null);
    try {
      if (files.length > 10)
        throw new Error("Choose no more than ten files at once.");
      const values = await Promise.all(
        Array.from(files).map(async (file) => {
          const kind: MediaKind = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
              ? "video"
              : file.type.startsWith("audio/")
                ? "audio"
                : "document";
          if (!allowed.includes(kind))
            throw new Error(
              `${file.name} is not an allowed ${allowed.join(" or ")} file.`,
            );
          return {
            name: file.name,
            contentType: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          };
        }),
      );
      queue.enqueue(values);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed.");
    }
  };
  const addExternal = async () => {
    if (readOnly || addingExternal) return;
    const controller = new AbortController();
    externalController.current = controller;
    setAddingExternal(true);
    setError(null);
    try {
      const kind = detectExternalMediaKind(external.trim());
      if (!allowed.includes(kind))
        throw new Error(`This picker allows ${allowed.join(" and ")} media.`);
      if (!adapter?.media?.createExternal)
        throw new Error("Your Host does not allow external media.");
      const item = await adapter.media.createExternal(external.trim(), kind, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      selectionTouched.current = true;
      setItems((previous) => [...previous, item]);
      setSelected((previous) =>
        selectMediaItem(previous, item, allowed, maximum),
      );
      setExternal("");
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not add external media.",
        );
    } finally {
      setAddingExternal(false);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="pb-media-picker">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Choose {maximum === 1 ? "one item" : `up to ${maximum} items`}.
              Only Select attaches media; closing discards pending selection.
            </DialogDescription>
          </DialogHeader>
          {adapters.length > 1 ? (
            <Field>
              <FieldLabel>Media library</FieldLabel>
              <InspectorSelect
                aria-label="Media library"
                value={adapterKind}
                onChange={(event) => setAdapterKind(event.currentTarget.value)}
              >
                {adapters.map(([key]) => (
                  <InspectorSelectOption key={key} value={key}>
                    {key}
                  </InspectorSelectOption>
                ))}
              </InspectorSelect>
            </Field>
          ) : null}
          {adapters.length ? (
            <Tabs value={tab} onValueChange={setTab} className="min-h-0">
              <TabsList>
                <TabsTrigger value="add">Add</TabsTrigger>
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
              </TabsList>
              <TabsContent value="add" className="pb-media-add">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`${id}-files`}>
                      Upload files (up to ten)
                    </FieldLabel>
                    <div
                      className="pb-media-drop"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        void uploadFiles(event.dataTransfer.files);
                      }}
                    >
                      <UploadIcon aria-hidden="true" />
                      <p>Drop files here or browse.</p>
                      <Input
                        id={`${id}-files`}
                        type="file"
                        multiple
                        disabled={readOnly || !adapter?.media?.upload}
                        accept={allowed
                          .map((item) =>
                            item === "document"
                              ? ".pdf,.txt,.csv,.docx,.xlsx,.pptx"
                              : `${item}/*`,
                          )
                          .join(",")}
                        onChange={(event) => {
                          void uploadFiles(event.currentTarget.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                    {!adapter?.media?.upload ? (
                      <p>Uploads are not enabled by this Host.</p>
                    ) : null}
                  </Field>
                  {entries.map((entry) => (
                    <div className="pb-media-upload" key={entry.id}>
                      <svg
                        className="pb-upload-perimeter"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="1"
                          y="1"
                          width="98"
                          height="98"
                          rx="3"
                          pathLength="100"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={`${entry.progress} 100`}
                        />
                      </svg>
                      <strong>{entry.file.name}</strong>
                      <progress
                        aria-label={`Upload progress for ${entry.file.name}`}
                        value={entry.progress}
                        max={100}
                      />
                      <span>
                        {Math.round(entry.progress)}% · {entry.status}
                      </span>
                      {entry.error ? (
                        <span role="alert">{entry.error}</span>
                      ) : null}
                      {entry.status === "uploading" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => queue?.cancel(entry.id)}
                        >
                          Cancel upload
                        </Button>
                      ) : entry.status === "failed" ||
                        entry.status === "cancelled" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => queue?.retry(entry.id)}
                        >
                          Retry upload
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove upload ${entry.file.name}`}
                        onClick={() => queue?.remove(entry.id)}
                      >
                        <XIcon data-icon="inline-start" />
                      </Button>
                    </div>
                  ))}
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={`${id}-url`}>External URL</FieldLabel>
                    <Input
                      id={`${id}-url`}
                      placeholder="https://…"
                      disabled={
                        readOnly ||
                        addingExternal ||
                        !adapter?.media?.createExternal
                      }
                      value={external}
                      aria-invalid={!!error}
                      onChange={(event) =>
                        setExternal(event.currentTarget.value)
                      }
                    />
                    <Button
                      variant="outline"
                      disabled={
                        readOnly ||
                        addingExternal ||
                        !external.trim() ||
                        !adapter?.media?.createExternal
                      }
                      onClick={() => void addExternal()}
                    >
                      Add external media
                    </Button>
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="gallery" className="min-h-0">
                <FieldGroup className="pb-media-filters">
                  <Field>
                    <FieldLabel htmlFor={`${id}-query`}>
                      Search media
                    </FieldLabel>
                    <Input
                      id={`${id}-query`}
                      value={query}
                      onChange={(event) => {
                        setQuery(event.currentTarget.value);
                        setScrollTop(0);
                      }}
                      placeholder="Name, filename, extension or host…"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <InspectorSelect
                      aria-label="Media type"
                      value={kind}
                      onChange={(event) => setKind(event.currentTarget.value)}
                    >
                      <InspectorSelectOption value="all">
                        All types
                      </InspectorSelectOption>
                      {allowed.map((item) => (
                        <InspectorSelectOption key={item} value={item}>
                          {item}
                        </InspectorSelectOption>
                      ))}
                    </InspectorSelect>
                  </Field>
                  <Field>
                    <FieldLabel>Source</FieldLabel>
                    <InspectorSelect
                      aria-label="Media source"
                      value={source}
                      onChange={(event) => setSource(event.currentTarget.value)}
                    >
                      <InspectorSelectOption value="all">
                        All sources
                      </InspectorSelectOption>
                      <InspectorSelectOption value="uploaded">
                        Uploaded
                      </InspectorSelectOption>
                      <InspectorSelectOption value="external">
                        External
                      </InspectorSelectOption>
                    </InspectorSelect>
                  </Field>
                  <Field>
                    <FieldLabel>Sort</FieldLabel>
                    <InspectorSelect
                      aria-label="Media sort"
                      value={sort}
                      onChange={(event) => setSort(event.currentTarget.value)}
                    >
                      {[
                        ["newest", "Newest"],
                        ["oldest", "Oldest"],
                        ["name-asc", "Name A–Z"],
                        ["name-desc", "Name Z–A"],
                      ].map(([value, text]) => (
                        <InspectorSelectOption key={value} value={value!}>
                          {text}
                        </InspectorSelectOption>
                      ))}
                    </InspectorSelect>
                  </Field>
                  <Field>
                    <FieldLabel>View</FieldLabel>
                    <InspectorSelect
                      aria-label="Media view"
                      value={view}
                      onChange={(event) => {
                        setView(event.currentTarget.value);
                        setScrollTop(0);
                      }}
                    >
                      <InspectorSelectOption value="masonry">
                        Masonry
                      </InspectorSelectOption>
                      <InspectorSelectOption value="grid">
                        Grid
                      </InspectorSelectOption>
                      <InspectorSelectOption value="list">
                        List
                      </InspectorSelectOption>
                    </InspectorSelect>
                  </Field>
                </FieldGroup>
                <div
                  className="pb-media-gallery"
                  ref={setGalleryNode}
                  tabIndex={0}
                  aria-label="Media results"
                  onScroll={(event) => {
                    const target = event.currentTarget;
                    setScrollTop(target.scrollTop);
                    if (
                      nextCursor &&
                      !loading &&
                      target.scrollHeight -
                        target.scrollTop -
                        target.clientHeight <
                        target.clientHeight / 2
                    )
                      void load(nextCursor);
                  }}
                >
                  {virtual ? (
                    <div
                      style={{ height: firstRow * rowHeight }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div
                    className={cn(
                      "pb-media-cards",
                      view === "list" && "pb-media-list",
                      view === "masonry" && "pb-media-masonry",
                    )}
                    style={
                      { "--pb-media-columns": columns } as React.CSSProperties
                    }
                  >
                    {visible.map((item) => {
                      const key = resourceKey(item.reference);
                      const selected = selectedKeys.has(key);
                      const disabled =
                        readOnly ||
                        !item.available ||
                        excludedKeys.has(key) ||
                        (!selected &&
                          maximum > 1 &&
                          selectedKeys.size >= maximum);
                      return (
                        <div
                          className="pb-media-card"
                          key={key}
                          data-media-key={key}
                        >
                          <button
                            className="pb-media-choice"
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            aria-label={`Select ${item.displayName}`}
                            onClick={() => choose(item)}
                          >
                            {item.kind === "image" &&
                            safeMediaUrl(item.thumbnailUrl ?? item.url) ? (
                              <img
                                loading="lazy"
                                src={safeMediaUrl(
                                  item.thumbnailUrl ?? item.url,
                                )}
                                alt=""
                              />
                            ) : (
                              <div className="pb-media-type" aria-hidden="true">
                                {item.kind === "audio"
                                  ? "▂ ▄ ▆ █ ▆ ▄ ▂"
                                  : item.kind === "video"
                                    ? "▶"
                                    : item.kind.toUpperCase()}
                              </div>
                            )}
                            <span>{item.displayName}</span>
                            <small>
                              {item.available
                                ? `${item.kind} · ${item.source}`
                                : "Unavailable"}
                            </small>
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Preview ${item.displayName}`}
                            onClick={() => setViewer(item)}
                          >
                            <EyeIcon data-icon="inline-start" />
                            Preview
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {virtual ? (
                    <div
                      style={{
                        height:
                          Math.max(
                            0,
                            Math.ceil(filtered.length / columns) -
                              firstRow -
                              rowCount,
                          ) * rowHeight,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {loading ? <p role="status">Loading media…</p> : null}
                  {!loading && !filtered.length ? (
                    <p role="status">No media found.</p>
                  ) : null}
                  {nextCursor ? (
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() => void load(nextCursor)}
                    >
                      Load more media
                    </Button>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <p>Your Host has not configured a media library.</p>
          )}
          {error ? <FieldError role="alert">{error}</FieldError> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected.length || readOnly}
              onClick={() => {
                onCommit(selected);
                onOpenChange(false);
              }}
            >
              Select ({selected.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MediaViewer item={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
