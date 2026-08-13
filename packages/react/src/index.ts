import { createElement, type ReactElement, type ReactNode } from "react";

import type {
  DocumentChangeEvent,
  Pagebldr,
  PageDocument,
  PreparedResources,
} from "@pagebldr/core";

export type { DocumentChangeEvent } from "@pagebldr/core";

export interface SaveRequest {
  readonly document: PageDocument;
  readonly reason: "manual" | "autosave";
  readonly signal: AbortSignal;
}

export interface PublishRequest {
  readonly document: PageDocument;
  readonly signal: AbortSignal;
}

export interface PagebldrEditorProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly onChange: (event: DocumentChangeEvent) => void;
  readonly onSave?: (request: SaveRequest) => void | Promise<void>;
  readonly onPublish?: (request: PublishRequest) => void | Promise<void>;
  readonly mode?: "edit" | "preview" | "readOnly";
  readonly children?: ReactNode;
}

export function PagebldrEditor({
  builder,
  children,
  document,
  mode = "edit",
}: PagebldrEditorProps): ReactElement {
  return createElement(
    "div",
    {
      "data-pagebldr-editor": builder.namespace,
      "data-pagebldr-document": document.id,
      "data-pagebldr-mode": mode,
    },
    children,
  );
}

export interface PagebldrRendererProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly resources?: PreparedResources;
}

export function PagebldrRenderer({
  builder,
  document,
}: PagebldrRendererProps): ReactElement {
  return createElement("main", {
    "data-pagebldr-document": document.id,
    "data-pagebldr-renderer": builder.namespace,
  });
}
