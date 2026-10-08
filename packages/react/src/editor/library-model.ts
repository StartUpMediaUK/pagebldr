import {
  createId,
  type ElementTree,
  type Pagebldr,
  type PagebldrClipboard,
  type PageDocument,
  type PageElement,
} from "@pagebldr/core";

// Thumbnail labels belong to the editor, not the authored Document palette.
// Choose the higher-contrast foreground for opaque hexadecimal accents.
export function thumbnailForeground(accent?: string): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(accent ?? "");
  if (!match) return "var(--foreground)";
  const hex =
    match[1]!.length === 3
      ? [...match[1]!].map((digit) => digit + digit).join("")
      : match[1]!;
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}

export function materializeBlock(
  builder: Pagebldr,
  input: ElementTree | PagebldrClipboard,
): PagebldrClipboard {
  if ("format" in input) return input;
  const elements: Record<string, PageElement> = {};
  const visit = (tree: ElementTree): string => {
    const definition = builder.elements.get(tree.type);
    if (!definition) throw new Error(`Unknown Element ${tree.type}`);
    const defaults = definition.defaults();
    const id = createId("element");
    elements[id] = {
      id,
      type: tree.type,
      elementVersion: definition.version,
      name: tree.name ?? definition.label,
      props: {
        ...(defaults && typeof defaults === "object" ? defaults : {}),
        ...tree.props,
      },
      children: (tree.children ?? []).map(visit),
      styles: tree.styles ?? {},
      classIds: [],
      locked: false,
      hidden: false,
    };
    return id;
  };
  return {
    format: "pagebldr-clipboard",
    schemaVersion: 1,
    rootId: visit(input),
    elements,
    classes: {},
    classOrder: [],
    variables: {},
    variableOrder: [],
  };
}
export function materializeTemplate(
  builder: Pagebldr,
  input: ElementTree | PageDocument,
): PageDocument {
  if ("format" in input) return input;
  const clipboard = materializeBlock(builder, input);
  return {
    ...builder.documents.create({ id: createId("page") }),
    ...clipboard,
    format: "pagebldr",
    schemaVersion: 2,
  };
}
