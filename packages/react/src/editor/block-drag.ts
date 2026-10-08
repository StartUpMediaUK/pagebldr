import type { PagebldrClipboard } from "@pagebldr/core";

export const pagebldrBlockDragType = "application/x-pagebldr-block";
let activeBlock: PagebldrClipboard | null = null;

export function startBlockDrag(
  transfer: DataTransfer,
  clipboard: PagebldrClipboard,
): void {
  activeBlock = clipboard;
  transfer.effectAllowed = "copy";
  transfer.setData(pagebldrBlockDragType, JSON.stringify(clipboard));
}
export function endBlockDrag(): void {
  activeBlock = null;
}
export function readBlockDrag(
  transfer: DataTransfer,
): PagebldrClipboard | null {
  if (!transfer.types.includes(pagebldrBlockDragType)) return null;
  const serialized = transfer.getData(pagebldrBlockDragType);
  if (!serialized) return activeBlock; // Browser protected-mode dragover.
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      value &&
      typeof value === "object" &&
      "format" in value &&
      value.format === "pagebldr-clipboard" &&
      "rootId" in value &&
      typeof value.rootId === "string" &&
      "elements" in value &&
      value.elements &&
      typeof value.elements === "object"
    )
      return value as PagebldrClipboard;
  } catch {
    /* An unrelated or malformed drag is not an editor action. */
  }
  return null;
}
