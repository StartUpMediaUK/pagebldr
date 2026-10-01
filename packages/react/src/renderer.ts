import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from "react";

import { resolveDestination, resourceKey } from "@pagebldr/core";
import type {
  Pagebldr,
  PageDocument,
  PreparedResources,
  RenderElement,
  RenderNode,
  ResourceReference,
  StyleState,
} from "@pagebldr/core";

export interface PagebldrRendererProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly resources?: PreparedResources;
  readonly mode?: "edit" | "preview" | "published";
  readonly now?: Date;
  readonly resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
  readonly styleNonce?: string;
  readonly forcedStyleState?: {
    readonly elementId: string;
    readonly state: Exclude<StyleState, "normal">;
  };
}

export function PagebldrRenderer({
  builder,
  document,
  resources = { values: new Map() },
  mode = "published",
  now = new Date(),
  resolveApplicationDestination,
  styleNonce,
  forcedStyleState,
}: PagebldrRendererProps): ReactElement {
  const compiled = builder.styles.compile(document);
  const renderElement = (id: string): ReactNode => {
    const element = document.elements[id]!;
    if (element.hidden && mode !== "edit") return null;
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
      mode,
      now,
      resource: (reference) =>
        resources.values.get(resourceKey(reference)) ?? null,
      destination: (value) =>
        resolveDestination(document, value, resolveApplicationDestination),
    });
    return toReact(rendered, id, {
      "data-pagebldr-element": id,
      id:
        typeof element.props.anchorId === "string"
          ? element.props.anchorId
          : `pagebldr-${id}`,
      ...(element.hidden ? { "data-pagebldr-hidden": "true" } : {}),
      ...(element.classIds.length > 0
        ? { "data-pagebldr-class": element.classIds.join(" ") }
        : {}),
      ...(mode === "edit" && forcedStyleState?.elementId === id
        ? { "data-pagebldr-force-state": forcedStyleState.state }
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
    mode === "edit"
      ? createElement(
          "style",
          {
            nonce: styleNonce,
            "data-pagebldr-edit-visibility": document.id,
          },
          `[${compiled.scopeAttribute}="${compiled.scopeValue}"][${compiled.documentAttribute}="${compiled.documentValue}"] [data-pagebldr-hidden="true"]{display:revert!important}`,
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
    {
      key,
      ...renderElement.attributes,
      ...(renderElement.style ? { style: renderElement.style } : {}),
      ...rootAttributes,
    },
    ...(renderElement.children ?? []).map((child, index) =>
      toReact(child, `${key}-${index}`, {}),
    ),
  );
}
