import { describe, expect, it, vi } from "vitest";
import {
  createMediaUploadQueue,
  detectExternalMediaKind,
  selectMediaItem,
  resolveMediaVideoEmbed,
  type MediaItem,
  type MediaCapabilities,
} from "./index.js";
const image = (id: string): MediaItem => ({
  reference: { kind: "asset", value: id },
  kind: "image",
  displayName: id,
  url: `https://example.com/${id}.png`,
  source: "uploaded",
  createdAt: "2026-10-07",
  available: true,
});
describe("shared media contracts", () => {
  it("embeds only validated HTTPS video providers without autoplay", () => {
    expect(resolveMediaVideoEmbed("https://youtu.be/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
    expect(resolveMediaVideoEmbed("https://vimeo.com/1234")).toBe(
      "https://player.vimeo.com/video/1234",
    );
    for (const url of [
      "http://youtu.be/abc",
      "https://user:pass@youtu.be/abc",
      "https://evil.example/123",
      "https://vimeo.com/not-an-id",
    ])
      expect(resolveMediaVideoEmbed(url)).toBeNull();
  });
  it("contains synchronous adapter failures and ignores non-finite progress", async () => {
    const queue = createMediaUploadQueue({
      describe: (item) => item as MediaItem,
      upload: (_file, context) => {
        context.onProgress(Number.NaN);
        throw new Error("Synchronous storage error");
      },
    });
    expect(() =>
      queue.enqueue([
        { name: "a.png", contentType: "image/png", bytes: new Uint8Array() },
      ]),
    ).not.toThrow();
    expect(queue.snapshot()[0]?.progress).toBe(0);
    await vi.waitFor(() =>
      expect(queue.snapshot()[0]?.error).toBe("Synchronous storage error"),
    );
  });
  it("replaces single selection and preserves click order, deduplication and limits", () => {
    expect(selectMediaItem([image("a")], image("b"), ["image"], 1)).toEqual([
      image("b"),
    ]);
    const selected = selectMediaItem([image("a")], image("b"), ["image"], 2);
    expect(selectMediaItem(selected, image("c"), ["image"], 2)).toBe(selected);
    expect(selectMediaItem(selected, image("a"), ["image"], 3)).toBe(selected);
    expect(
      selectMediaItem([], { ...image("a"), available: false }, ["image"], 2),
    ).toEqual([]);
    expect(selectMediaItem([], image("a"), ["video"], 2)).toEqual([]);
  });
  it("validates HTTPS and detects the invoking media kind", () => {
    expect(
      detectExternalMediaKind("https://example.com/photo.PNG?size=1"),
    ).toBe("image");
    expect(detectExternalMediaKind("https://youtu.be/123")).toBe("video");
    expect(detectExternalMediaKind("https://example.com/a.mp3")).toBe("audio");
    expect(detectExternalMediaKind("https://example.com/a.pdf")).toBe(
      "document",
    );
    expect(() => detectExternalMediaKind("http://example.com/a.jpg")).toThrow(
      "HTTPS",
    );
    expect(() =>
      detectExternalMediaKind("https://user:password@example.com/a.jpg"),
    ).toThrow("credentials");
  });
  it("completes uploads with progress without attaching Resources to a Document", async () => {
    const upload: MediaCapabilities["upload"] = (_file, context) => {
      context.onProgress(45);
      return Promise.resolve(image("uploaded"));
    };
    const queue = createMediaUploadQueue({
      describe: (item) => item as MediaItem,
      upload,
    });
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    queue.enqueue([
      {
        name: "photo.png",
        contentType: "image/png",
        bytes: new Uint8Array([1]),
      },
    ]);
    await vi.waitFor(() =>
      expect(queue.snapshot()[0]?.status).toBe("complete"),
    );
    expect(queue.snapshot()[0]?.progress).toBe(100);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    expect(() =>
      queue.enqueue(
        Array.from({ length: 11 }, () => ({
          name: "a",
          contentType: "image/png",
          bytes: new Uint8Array(),
        })),
      ),
    ).toThrow("ten");
  });
  it("ignores late completion after cancellation and supports retry and removal", async () => {
    let resolve: ((item: MediaItem) => void) | undefined;
    const queue = createMediaUploadQueue({
      describe: (item) => item as MediaItem,
      upload: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    queue.enqueue([
      { name: "a.png", contentType: "image/png", bytes: new Uint8Array() },
    ]);
    const id = queue.snapshot()[0]!.id;
    queue.cancel(id);
    resolve?.(image("late"));
    await Promise.resolve();
    expect(queue.snapshot()[0]?.status).toBe("cancelled");
    queue.retry(id);
    expect(queue.snapshot()[0]?.status).toBe("uploading");
    resolve?.(image("retried"));
    await vi.waitFor(() =>
      expect(queue.snapshot()[0]?.status).toBe("complete"),
    );
    queue.remove(id);
    expect(queue.snapshot()).toEqual([]);
  });
  it("surfaces upload failures and refuses missing Host capabilities", async () => {
    const readOnly = createMediaUploadQueue({
      describe: (item) => item as MediaItem,
    });
    expect(() => readOnly.enqueue([])).toThrow("Host");
    const queue = createMediaUploadQueue({
      describe: (item) => item as MediaItem,
      upload: () => Promise.reject(new Error("Storage unavailable")),
    });
    queue.enqueue([
      { name: "a.png", contentType: "image/png", bytes: new Uint8Array() },
    ]);
    await vi.waitFor(() =>
      expect(queue.snapshot()[0]?.error).toBe("Storage unavailable"),
    );
    expect(queue.snapshot()[0]?.status).toBe("failed");
  });
});
