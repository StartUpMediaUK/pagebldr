import type {
  BlockDefinition,
  TemplateDefinition,
  PagebldrClipboard,
  PageDocument,
} from "@pagebldr/core";

/** Hosts return only the catalogue and management capabilities this actor may use. */
export interface EditorLibrarySource {
  readonly listBlocks?: (
    signal: AbortSignal,
  ) => Promise<readonly BlockDefinition[]>;
  readonly saveBlock?: (request: {
    readonly label: string;
    readonly clipboard: PagebldrClipboard;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly deleteBlock?: (key: string, signal: AbortSignal) => Promise<void>;
  readonly listTemplates?: (
    signal: AbortSignal,
  ) => Promise<readonly TemplateDefinition[]>;
  readonly deleteTemplate?: (key: string, signal: AbortSignal) => Promise<void>;
  readonly editTemplate?: (key: string) => void;
  readonly adaptBlockReferences?: (
    clipboard: PagebldrClipboard,
    signal: AbortSignal,
  ) => Promise<PagebldrClipboard>;
  readonly adaptTemplateReferences?: (
    document: PageDocument,
    signal: AbortSignal,
  ) => Promise<PageDocument>;
}
