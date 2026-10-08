"use client";

import { useEffect, useState } from "react";

const maximumPdfBytes = 20 * 1024 * 1024;

// Browser PDF plugins are blocked by iframe sandboxing. Never navigate an
// unsandboxed frame to arbitrary Host content: first read bounded bytes and
// verify the PDF signature, then create a PDF-only object URL.
export async function readPreviewPdf(
  url: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok || !response.body)
    throw new Error("PDF preview could not be loaded.");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumPdfBytes)
        throw new Error(
          "PDF preview is limited to 20 MB. Download the file instead.",
        );
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel();
  }
  const blob = new Blob(chunks, { type: "application/pdf" });
  if (!(await blob.slice(0, 5).text()).startsWith("%PDF-"))
    throw new Error(
      "This file is not a PDF. Download it to inspect it safely.",
    );
  return blob;
}

export function PdfPreview({
  url,
  name,
}: {
  readonly url: string;
  readonly name: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setPreview(null);
    setError(null);
    void readPreviewPdf(url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "PDF preview unavailable. Download the file instead.",
          );
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return preview ? (
    <iframe title={`${name} PDF preview`} src={preview} />
  ) : (
    <p role="status">{error ?? "Loading PDF preview…"}</p>
  );
}
