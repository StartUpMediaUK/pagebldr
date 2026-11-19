import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  type ComponentType,
} from "react";

import { PagebldrError, resolveDestination, resourceKey } from "@pagebldr/core";
import type {
  Pagebldr,
  PageDocument,
  PreparedResources,
  RenderElement,
  RenderNode,
  ResourceReference,
  StyleState,
  ElementDefinition,
  ElementRenderContext,
  InferSchemaOutput,
  StandardSchemaV1,
} from "@pagebldr/core";
import { menuResponsiveStyles } from "./menu-styles.js";

// React 18 HTML-escapes style children during SSR; raw-text style elements do
// not decode those entities. Emit identical server/client CSS while preventing
// authored values from terminating the style element.
function styleMarkup(css: string): { __html: string } {
  return { __html: css.replace(/</g, "\\3c ") };
}
function cssAttribute(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9_-]/g,
    (character) => `\\${character.codePointAt(0)!.toString(16)} `,
  );
}

export interface ReactElementRenderProps<
  Props = Readonly<Record<string, unknown>>,
> {
  readonly props: Props;
  readonly context: Omit<ElementRenderContext, "children"> & {
    readonly children: ReactNode;
  };
}

export interface ReactElementRenderer {
  readonly type: string;
  readonly version: number;
  readonly component: ComponentType<ReactElementRenderProps>;
}

/** Register application code, never executable Document content. */
export function defineReactElementRenderer<Schema extends StandardSchemaV1>(
  definition: ElementDefinition<string, Schema>,
  component: ComponentType<ReactElementRenderProps<InferSchemaOutput<Schema>>>,
): ReactElementRenderer {
  return Object.freeze({
    type: definition.type,
    version: definition.version,
    component: component as ComponentType<ReactElementRenderProps>,
  });
}

export interface PagebldrRendererProps {
  /** Render one owned subtree while retaining page-wide styles and link resolution. */
  readonly rootElementId?: string;
  readonly elementRenderers?: readonly ReactElementRenderer[];
  /** Reveal the ancestor panels of the selected Element in edit mode. */
  readonly selectedElementId?: string | null;
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
  rootElementId,
  builder,
  document,
  resources = { values: new Map() },
  mode = "published",
  now = new Date(),
  resolveApplicationDestination,
  styleNonce,
  forcedStyleState,
  elementRenderers = [],
  selectedElementId,
}: PagebldrRendererProps): ReactElement {
  const compiled = builder.styles.compile(document);
  const renderers = new Map<string, ReactElementRenderer>();
  for (const renderer of elementRenderers) {
    const definition = builder.elements.get(renderer.type);
    if (
      !definition ||
      definition.version !== renderer.version ||
      renderers.has(renderer.type)
    )
      throw new PagebldrError(
        "INVALID_CONFIGURATION",
        `Invalid or duplicate React Element renderer: ${renderer.type}.`,
      );
    renderers.set(renderer.type, renderer);
  }
  const selectedPath = new Set<string>();
  const findSelected = (id: string): boolean => {
    const selected =
      id === selectedElementId ||
      document.elements[id]!.children.some(findSelected);
    if (selected) selectedPath.add(id);
    return selected;
  };
  const renderRootId = rootElementId ?? document.rootId;
  if (!document.elements[renderRootId])
    throw new PagebldrError(
      "BROKEN_REFERENCE",
      "The rendering root is missing.",
    );
  if (mode === "edit" && selectedElementId) findSelected(renderRootId);
  const renderElement = (id: string): ReactNode => {
    const element = document.elements[id]!;
    if (element.hidden && mode !== "edit") return null;
    const definition = builder.elements.get(element.type);
    const renderer = renderers.get(element.type);
    if (!definition || (!definition.render && !renderer)) {
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
    const childIds = element.children.filter(
      (childId) => mode === "edit" || !document.elements[childId]!.hidden,
    );
    const context: ElementRenderContext = {
      elementId: id,
      childElements: childIds.map((childId) => document.elements[childId]!),
      ...(childIds.find((childId) => selectedPath.has(childId))
        ? {
            selectedChildId: childIds.find((childId) =>
              selectedPath.has(childId),
            )!,
          }
        : {}),
      children: childIds.map((childId) => renderElement(childId) as RenderNode),
      mode,
      now,
      resource: (reference) =>
        resources.values.get(resourceKey(reference)) ?? null,
      destination: (value) =>
        resolveDestination(document, value, resolveApplicationDestination),
    };
    const attributes = {
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
    };
    if (renderer)
      return createElement(
        "div",
        { key: id, ...attributes },
        createElement(renderer.component, {
          props: element.props,
          context: { ...context, children: context.children as ReactNode },
        }),
      );
    return toReact(definition.render!(element.props, context), id, attributes);
  };
  return createElement(
    Fragment,
    null,
    Object.values(document.elements).some((element) => element.type === "menu")
      ? createElement("style", {
          nonce: styleNonce,
          "data-pagebldr-menu-styles": document.id,
          dangerouslySetInnerHTML: styleMarkup(
            menuResponsiveStyles(builder.namespace, document),
          ),
        })
      : null,
    compiled.css
      ? createElement("style", {
          nonce: styleNonce,
          "data-pagebldr-authored-styles": document.id,
          dangerouslySetInnerHTML: styleMarkup(compiled.css),
        })
      : null,
    mode === "edit"
      ? createElement("style", {
          nonce: styleNonce,
          "data-pagebldr-edit-visibility": document.id,
          dangerouslySetInnerHTML: styleMarkup(
            `[${compiled.scopeAttribute}="${cssAttribute(compiled.scopeValue)}"][${compiled.documentAttribute}="${cssAttribute(compiled.documentValue)}"] [data-pagebldr-hidden="true"]{display:revert!important}`,
          ),
        })
      : null,
    createElement(
      "main",
      {
        [compiled.scopeAttribute]: compiled.scopeValue,
        [compiled.documentAttribute]: compiled.documentValue,
        "data-pagebldr-renderer": builder.namespace,
        ...(mode === "edit" && selectedElementId
          ? { "data-pagebldr-selection": selectedElementId }
          : {}),
      },
      renderElement(renderRootId),
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
