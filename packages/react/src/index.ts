import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
  useEffect,
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
import type {
  AnalyticsEvent,
  EventDelivery,
  PublishedPage,
} from "@pagebldr/runtime";
import { EditorShell } from "./editor/editor-shell.js";
import type { EditorContribution, EditorPreset } from "./editor/composition.js";

export type { DocumentChangeEvent } from "@pagebldr/core";
export { usePagebldrEditor } from "./editor/context.js";
export type {
  EditorContextValue,
  EditorMode,
  EditorViewport,
} from "./editor/context.js";
export {
  createEditorComposition,
  defineEditorContribution,
  defineEditorPreset,
  editorSlots,
} from "./editor/composition.js";
export type {
  EditorCapability,
  EditorComposition,
  EditorContribution,
  EditorContributionContext,
  EditorContributionKind,
  EditorPlacement,
  EditorPreset,
  EditorSlot,
} from "./editor/composition.js";
export { focusEditorPreset, standardEditorPreset } from "./editor/presets.js";

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
  readonly className?: string;
  readonly preset?: EditorPreset;
  readonly contributions?: readonly EditorContribution[];
}

export function PagebldrEditor(props: PagebldrEditorProps): ReactElement {
  const { builder, children, className, document, mode = "edit" } = props;
  if (!children) return createElement(EditorShell, props);
  return createElement(
    "div",
    {
      className,
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

export interface PagebldrPageProps {
  readonly builder: Pagebldr;
  readonly page: PublishedPage;
  readonly events?: EventDelivery;
  readonly analyticsConsent?: boolean;
  readonly visit?: "mount" | "manual" | false;
  readonly styleNonce?: string;
}

export function PagebldrPage({
  builder,
  page,
  events,
  analyticsConsent = false,
  visit = "mount",
  styleNonce,
}: PagebldrPageProps): ReactElement {
  useEffect(() => {
    if (!events || !analyticsConsent || visit !== "mount") return;
    void emitAnalytics(events, page, "page.visit", {});
  }, [analyticsConsent, events, page, visit]);
  const track = (event: { readonly target: EventTarget | null }) => {
    if (!events || !analyticsConsent || !(event.target instanceof Element))
      return;
    const target = event.target.closest<HTMLElement>("[data-pagebldr-action]");
    const element = target?.closest<HTMLElement>("[data-pagebldr-element]");
    if (!target || !element) return;
    void emitAnalytics(events, page, "element.interaction", {
      action: target.dataset.pagebldrAction ?? "activate",
      elementId: element.dataset.pagebldrElement ?? "unknown",
    });
  };
  return createElement(
    "div",
    { onClick: track, onSubmit: track, "data-pagebldr-page": page.document.id },
    createElement(PagebldrRenderer, {
      builder,
      document: page.document,
      resources: page.resources,
      mode: "published",
      ...(styleNonce ? { styleNonce } : {}),
    }),
  );
}

async function emitAnalytics(
  events: EventDelivery,
  page: PublishedPage,
  type: AnalyticsEvent["type"],
  input: { readonly action?: string; readonly elementId?: string },
): Promise<void> {
  await events.analytics({
    type,
    context: page.eventContext,
    subject: {
      documentId: page.document.id,
      ...(input.elementId ? { elementId: input.elementId } : {}),
    },
    data: {
      path: page.canonicalPath,
      ...(input.action ? { action: input.action } : {}),
    },
  });
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
