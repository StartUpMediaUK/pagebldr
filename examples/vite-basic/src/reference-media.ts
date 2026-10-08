import {
  createId,
  type ResourceAdapter,
  type MediaItem,
  type MediaKind,
  type StandardSchemaV1,
} from "pagebldr";

const reference: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "reference-media",
    validate: (value) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Expected a string media reference." }] },
  },
};
export function createReferenceMediaAdapter(): ResourceAdapter {
  const items = new Map<string, MediaItem>();
  const attempts = new Map<string, number>();
  const add = (
    id: string,
    kind: MediaKind,
    name: string,
    url: string | null,
    extra: Partial<MediaItem> = {},
  ) => {
    const item: MediaItem = {
      reference: { kind: "asset", value: id },
      kind,
      displayName: name,
      originalName: name,
      url,
      source: "uploaded",
      createdAt: new Date().toISOString(),
      available: !!url,
      ...extra,
    };
    items.set(id, item);
    return item;
  };
  for (let i = 1; i <= 60; i++) {
    // Neutral, original geometric testing imagery; no copied source assets.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="${140 + (i % 4) * 30}" viewBox="0 0 240 180"><rect width="240" height="180" fill="hsl(${i * 37} 45% 86%)"/><circle cx="160" cy="65" r="40" fill="hsl(${i * 37} 40% 65%)"/><path d="M0 180 85 70 160 180Z" fill="hsl(${i * 37} 40% 45%)"/><text x="14" y="24" font-family="sans-serif" fill="#18212b">Reference image ${i}</text></svg>`;
    add(
      `image-${i}`,
      "image",
      `Reference image ${String(i).padStart(2, "0")}.svg`,
      URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
      { createdAt: new Date(Date.UTC(2026, 0, i)).toISOString() },
    );
  }
  add(
    "video-1",
    "video",
    "Flower video.mp4",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  );
  add(
    "audio-1",
    "audio",
    "Audio sample.mp3",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
  );
  for (const extension of ["txt", "csv", "docx", "xlsx", "pptx"]) {
    const text =
      extension === "csv"
        ? "name,value\nExample,42"
        : "Reference document <script>alert('escaped')</script>";
    add(
      `document-${extension}`,
      "document",
      `Reference document.${extension}`,
      URL.createObjectURL(new Blob([text], { type: "text/plain" })),
      { text },
    );
  }
  const content = "BT /F1 14 Tf 20 170 Td (Original Reference PDF) Tj ET";
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  add(
    "document-pdf",
    "document",
    "Reference document.pdf",
    URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })),
  );
  add("unavailable", "image", "Unavailable image.png", null);
  return {
    reference,
    resolve: (id) =>
      typeof id === "string" ? (items.get(id)?.url ?? null) : null,
    browse: ({ query = "", cursor = "0", media }) => {
      const filtered = [...items.values()].filter(
        (item) =>
          [item.displayName, item.originalName, item.url]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!media ||
            (media.allowed.includes(item.kind) &&
              (!media.kind || item.kind === media.kind) &&
              (!media.source || item.source === media.source))),
      );
      filtered.sort((a, b) =>
        media?.sort === "name-asc"
          ? a.displayName.localeCompare(b.displayName)
          : media?.sort === "name-desc"
            ? b.displayName.localeCompare(a.displayName)
            : media?.sort === "oldest"
              ? a.createdAt.localeCompare(b.createdAt)
              : b.createdAt.localeCompare(a.createdAt),
      );
      const offset = Number(cursor);
      return Promise.resolve({
        items: filtered.slice(offset, offset + 20),
        ...(offset + 20 < filtered.length
          ? { nextCursor: String(offset + 20) }
          : {}),
      });
    },
    media: {
      lookup: (reference) =>
        Promise.resolve(
          reference.kind === "asset" && typeof reference.value === "string"
            ? (items.get(reference.value) ?? null)
            : null,
        ),
      describe: (item) => item as MediaItem,
      createExternal: (url, kind) =>
        Promise.resolve(
          add(
            createId("external"),
            kind,
            new URL(url).pathname.split("/").pop() || new URL(url).hostname,
            url,
            { source: "external" },
          ),
        ),
      upload: async (file, context) => {
        const attempt = (attempts.get(file.name) ?? 0) + 1;
        attempts.set(file.name, attempt);
        for (let progress = 10; progress <= 100; progress += 10) {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          if (context.signal?.aborted) throw new Error("Upload cancelled");
          context.onProgress(progress);
          if (
            file.name.startsWith("fail-once") &&
            attempt === 1 &&
            progress === 40
          )
            throw new Error(
              "Simulated first upload failure. Retry is supported.",
            );
        }
        const kind: MediaKind = file.contentType.startsWith("image/")
          ? "image"
          : file.contentType.startsWith("video/")
            ? "video"
            : file.contentType.startsWith("audio/")
              ? "audio"
              : "document";
        return add(
          createId("uploaded"),
          kind,
          file.name,
          URL.createObjectURL(
            new Blob([new Uint8Array(file.bytes)], { type: file.contentType }),
          ),
        );
      },
    },
  };
}

// Independent read-only adapter: object references, no upload/external capability.
export function createCuratedMediaAdapter(): ResourceAdapter {
  const url = URL.createObjectURL(
    new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#e8eedf"/><text x="20" y="80">Curated illustration</text></svg>',
      ],
      { type: "image/svg+xml" },
    ),
  );
  const item: MediaItem = {
    reference: { kind: "curated-media", value: { slug: "illustration" } },
    kind: "image",
    displayName: "Curated illustration",
    url,
    source: "external",
    createdAt: "2026-01-01",
    available: true,
  };
  return {
    reference: {
      "~standard": {
        version: 1,
        vendor: "curated-example",
        validate: (value) =>
          value &&
          typeof value === "object" &&
          "slug" in value &&
          value.slug === "illustration"
            ? { value }
            : { issues: [{ message: "Unknown curated illustration." }] },
      },
    },
    resolve: () => url,
    browse: () =>
      Promise.resolve({
        items: [{ slug: "illustration", title: "Curated illustration" }],
      }),
    media: {
      describe: () => item,
      lookup: (reference) =>
        Promise.resolve(reference.kind === "curated-media" ? item : null),
    },
  };
}
