import type { Pagebldr, PageDocument } from "@pagebldr/core";

/** Host-scoped storage. No browser globals are accessed by the package. */
export interface EditorRecoveryStorage {
  readonly read: () => string | null;
  readonly write: (payload: string) => void;
  readonly remove: () => void;
}

export interface EditorRecovery {
  readonly schemaVersion: 1;
  readonly document: PageDocument;
  readonly version: number;
  readonly savedAt: string;
}

export function readRecovery(
  builder: Pagebldr,
  documentId: string,
  storage: EditorRecoveryStorage,
): EditorRecovery | null {
  const raw = storage.read();
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("schemaVersion" in value) ||
      value.schemaVersion !== 1 ||
      !("version" in value) ||
      typeof value.version !== "number" ||
      !Number.isSafeInteger(value.version) ||
      value.version < 1 ||
      !("savedAt" in value) ||
      typeof value.savedAt !== "string" ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      !("document" in value)
    )
      throw new Error("Invalid recovery payload.");
    const document = builder.documents.migrate(value.document);
    if (document.id !== documentId) throw new Error("Another Document.");
    return Object.freeze({
      schemaVersion: 1,
      version: value.version,
      savedAt: value.savedAt,
      document: structuredClone(document),
    });
  } catch {
    // Do not erase a replacement written by another editor session.
    if (storage.read() === raw) storage.remove();
    return null;
  }
}

export function encodeRecovery(
  document: PageDocument,
  version: number,
): string {
  return JSON.stringify({
    schemaVersion: 1,
    document,
    version,
    savedAt: new Date().toISOString(),
  } satisfies EditorRecovery);
}
