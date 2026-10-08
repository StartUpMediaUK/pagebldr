import { afterEach, describe, expect, it, vi } from "vitest";
import { readPreviewPdf } from "./pdf-preview.js";

afterEach(() => vi.unstubAllGlobals());
describe("PDF viewer content boundary", () => {
  it("retypes verified PDF bytes without navigating to the Host URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("%PDF-1.7\noriginal test PDF")),
    );
    const blob = await readPreviewPdf(
      "https://example.com/file",
      new AbortController().signal,
    );
    expect(blob.type).toBe("application/pdf");
    expect(await blob.text()).toContain("%PDF-");
  });
  it("rejects HTML disguised by a PDF filename or content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<script>alert(1)</script>", {
          headers: { "content-type": "application/pdf" },
        }),
      ),
    );
    await expect(
      readPreviewPdf(
        "https://example.com/file.pdf",
        new AbortController().signal,
      ),
    ).rejects.toThrow("not a PDF");
  });
  it("bounds streamed data even when the Host omits content length", async () => {
    const bytes = new Uint8Array(20 * 1024 * 1024 + 1);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
    await expect(
      readPreviewPdf(
        "https://example.com/large.pdf",
        new AbortController().signal,
      ),
    ).rejects.toThrow("20 MB");
  });
  it("surfaces inaccessible files without introducing a frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    await expect(
      readPreviewPdf(
        "https://example.com/private.pdf",
        new AbortController().signal,
      ),
    ).rejects.toThrow("could not be loaded");
  });
});
