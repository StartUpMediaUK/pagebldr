import type { PagebldrClipboard } from "./clipboard.js";
import type { PageDocument, ResponsiveStyles } from "./document-types.js";

export interface ElementTree {
  readonly type: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly ElementTree[];
  readonly name?: string;
  readonly styles?: ResponsiveStyles;
}

export interface LibraryMetadata {
  readonly key: string;
  readonly label: string;
  readonly category?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly thumbnail?: {
    readonly accent: string;
    readonly eyebrow: string;
    readonly summary: string;
  };
}

export interface BlockDefinition extends LibraryMetadata {
  readonly create: () => ElementTree | PagebldrClipboard;
}

export interface TemplateDefinition extends LibraryMetadata {
  readonly create: () => ElementTree | PageDocument;
}

export function defineBlock<const Definition extends BlockDefinition>(
  definition: Definition,
): Readonly<Definition> {
  return Object.freeze(definition);
}

export function defineTemplate<const Definition extends TemplateDefinition>(
  definition: Definition,
): Readonly<Definition> {
  return Object.freeze(definition);
}
