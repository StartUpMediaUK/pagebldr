import { createId } from "./ids.js";
import { resourceKey } from "./resources.js";
import {
  PagebldrError,
  type MediaItem,
  type MediaKind,
  type MediaUpload,
  type MediaCapabilities,
  type ResourceContext,
} from "./types.js";

export function selectMediaItem(
  selected: readonly MediaItem[],
  item: MediaItem,
  allowed: readonly MediaKind[],
  maximum: number,
): readonly MediaItem[] {
  if (!item.available || !allowed.includes(item.kind) || maximum < 1)
    return selected;
  const key = resourceKey(item.reference);
  if (selected.some((value) => resourceKey(value.reference) === key))
    return selected;
  if (maximum === 1) return [item];
  return selected.length < maximum ? [...selected, item] : selected;
}

export function detectExternalMediaKind(input: string): MediaKind {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new PagebldrError(
      "INVALID_ELEMENT",
      "Use a public HTTPS media URL without credentials.",
    );
  const path = url.pathname.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/u.test(path)) return "image";
  if (
    /\.(mp4|webm|ogg|mov)$/u.test(path) ||
    /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/u.test(url.hostname)
  )
    return "video";
  if (/\.(mp3|wav|m4a|flac)$/u.test(path)) return "audio";
  return "document";
}

/** Allowlisted provider preview URL; arbitrary external HTML is never embedded. */
export function resolveMediaVideoEmbed(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        url.hostname,
      )
    ) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.split("/")[1]
          : (url.searchParams.get("v") ??
            url.pathname.split("/").filter(Boolean).at(-1));
      return id && /^[a-zA-Z0-9_-]{1,64}$/u.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (["vimeo.com", "www.vimeo.com"].includes(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean).at(-1);
      return id && /^\d+$/u.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null;
    }
  } catch {
    /* An invalid media URL is not an embed. */
  }
  return null;
}

export interface MediaUploadEntry {
  readonly id: string;
  readonly file: MediaUpload;
  readonly progress: number;
  readonly status: "uploading" | "complete" | "failed" | "cancelled";
  readonly item?: MediaItem;
  readonly error?: string;
}
export interface MediaUploadQueue {
  readonly snapshot: () => readonly MediaUploadEntry[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly enqueue: (files: readonly MediaUpload[]) => void;
  readonly cancel: (id: string) => void;
  readonly retry: (id: string) => void;
  readonly remove: (id: string) => void;
}
export function createMediaUploadQueue(
  capabilities: MediaCapabilities,
  context: ResourceContext = {},
): MediaUploadQueue {
  let entries: readonly MediaUploadEntry[] = [];
  const listeners = new Set<() => void>();
  const controllers = new Map<string, AbortController>();
  const update = (entry: MediaUploadEntry) => {
    entries = entries.map((current) =>
      current.id === entry.id ? entry : current,
    );
    listeners.forEach((listener) => listener());
  };
  const run = (entry: MediaUploadEntry) => {
    const controller = new AbortController();
    controllers.set(entry.id, controller);
    update({ ...entry, status: "uploading", progress: 0 });
    let upload: Promise<MediaItem>;
    try {
      upload = capabilities.upload!(entry.file, {
        ...context,
        signal: controller.signal,
        onProgress: (progress) => {
          if (
            !controller.signal.aborted &&
            controllers.get(entry.id) === controller &&
            Number.isFinite(progress)
          )
            update({
              ...entry,
              status: "uploading",
              progress: Math.max(0, Math.min(100, progress)),
            });
        },
      });
    } catch (error) {
      upload = Promise.reject(
        error instanceof Error ? error : new Error("Upload failed"),
      );
    }
    void upload
      .then((item) => {
        if (
          !controller.signal.aborted &&
          controllers.get(entry.id) === controller
        )
          update({ ...entry, status: "complete", progress: 100, item });
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          controllers.get(entry.id) === controller
        )
          update({
            ...entry,
            status: "failed",
            progress: 0,
            error: error instanceof Error ? error.message : "Upload failed",
          });
      })
      .finally(() => {
        if (controllers.get(entry.id) === controller)
          controllers.delete(entry.id);
      });
  };
  const cancel = (id: string) => {
    controllers.get(id)?.abort();
    controllers.delete(id);
    const entry = entries.find((current) => current.id === id);
    if (entry?.status === "uploading")
      update({ ...entry, status: "cancelled" });
  };
  return {
    snapshot: () => entries,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    enqueue: (files) => {
      if (!capabilities.upload)
        throw new PagebldrError(
          "CAPABILITY_UNAVAILABLE",
          "The Host does not allow uploads.",
        );
      if (files.length > 10)
        throw new PagebldrError(
          "STRUCTURAL_LIMIT",
          "Choose no more than ten files at once.",
        );
      const added = files.map((file): MediaUploadEntry => ({
        id: createId("upload"),
        file,
        progress: 0,
        status: "uploading",
      }));
      entries = [...entries, ...added];
      added.forEach(run);
    },
    cancel,
    retry: (id) => {
      const entry = entries.find((current) => current.id === id);
      if (entry && (entry.status === "failed" || entry.status === "cancelled"))
        run(entry);
    },
    remove: (id) => {
      cancel(id);
      entries = entries.filter((entry) => entry.id !== id);
      listeners.forEach((listener) => listener());
    },
  };
}
