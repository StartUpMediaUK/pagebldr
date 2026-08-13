import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from "react";

import type {
  DocumentChangeEvent,
  Pagebldr,
  PageDocument,
  PreparedResources,
  RenderElement,
  RenderNode,
} from "@pagebldr/core";
import { resourceKey } from "@pagebldr/core";

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
    children ??
      createElement(PagebldrRenderer, {
        builder,
        document,
        mode: mode === "edit" ? "edit" : "preview",
      }),
  );
}

export interface PagebldrRendererProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly resources?: PreparedResources;
  readonly mode?: "edit" | "preview" | "published";
  readonly styleNonce?: string;
}

export function PagebldrRenderer({
  builder,
  document,
  resources = { values: new Map() },
  mode = "published",
  styleNonce,
}: PagebldrRendererProps): ReactElement {
  const compiled = builder.styles.compile(document);
  const renderElement = (id: string): ReactNode => {
    const element = document.elements[id]!;
    const definition = builder.elements.get(element.type);
    if (!definition?.render) {
      return mode === "edit"
        ? createElement(
            "div",
            {
              key: id,
              role: "status",
              "data-pagebldr-element": id,
              "data-pagebldr-unknown": element.type,
            },
            `Unknown Element: ${element.type}`,
          )
        : null;
    }
    const rendered = definition.render(element.props, {
      children: element.children.map(
        (childId) => renderElement(childId) as RenderNode,
      ),
      resource: (reference) =>
        resources.values.get(resourceKey(reference)) ?? null,
    });
    return toReact(rendered, id, {
      "data-pagebldr-element": id,
      ...(element.classIds.length > 0
        ? { "data-pagebldr-class": element.classIds.join(" ") }
        : {}),
    });
  };
  return createElement(
    Fragment,
    null,
    compiled.css
      ? createElement(
          "style",
          { nonce: styleNonce, "data-pagebldr-authored-styles": document.id },
          compiled.css,
        )
      : null,
    createElement(
      "main",
      {
        [compiled.scopeAttribute]: compiled.scopeValue,
        [compiled.documentAttribute]: compiled.documentValue,
        "data-pagebldr-renderer": builder.namespace,
      },
      renderElement(document.rootId),
    ),
  );
}

function toReact(
  node: RenderNode | ReactNode,
  key: string,
  rootAttributes: Record<string, string>,
): ReactNode {
  if (node === null || typeof node === "string" || typeof node === "number")
    return createElement("span", { key, ...rootAttributes }, node);
  if (typeof node !== "object" || !("tag" in node)) return node;
  const renderElement: RenderElement = node;
  return createElement(
    renderElement.tag,
    { key, ...renderElement.attributes, ...rootAttributes },
    ...(renderElement.children ?? []).map((child, index) =>
      toReact(child, `${key}-${index}`, {}),
    ),
  );
}
