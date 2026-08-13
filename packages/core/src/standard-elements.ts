import {
  defineElement,
  type ElementDefinition,
  type ElementRenderContext,
  type RenderElement,
  type RenderNode,
} from "./element.js";
import type { StandardSchemaV1 } from "./schema.js";
import { defineStyleCapability } from "./styles.js";
import type { ResourceReference } from "./types.js";

type Props = Record<string, unknown>;

const propsSchema: StandardSchemaV1<unknown, Props> = {
  "~standard": {
    version: 1,
    vendor: "pagebldr",
    validate: (value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? { value: value as Props }
        : { issues: [{ message: "Element properties must be an object." }] },
  },
};

export const standardStyleCapabilities = Object.freeze([
  defineStyleCapability({
    key: "layout",
    label: "Layout",
    properties: [
      "align-items",
      "display",
      "flex-direction",
      "gap",
      "justify-content",
      "margin",
      "max-width",
      "padding",
      "width",
    ],
  }),
  defineStyleCapability({
    key: "typography",
    label: "Typography",
    properties: [
      "color",
      "font-family",
      "font-size",
      "font-style",
      "font-weight",
      "letter-spacing",
      "line-height",
      "text-align",
      "text-decoration",
    ],
  }),
  defineStyleCapability({
    key: "decoration",
    label: "Decoration",
    properties: [
      "background",
      "border",
      "border-radius",
      "box-shadow",
      "opacity",
    ],
  }),
]);

const allStyles = standardStyleCapabilities.map(({ key }) => key);
const children = { kind: "any" } as const;
const none = { kind: "none" } as const;

function element(
  type: string,
  label: string,
  defaults: Props,
  render: (props: Props, context: ElementRenderContext) => RenderNode,
  childPolicy: ElementDefinition["childPolicy"] = none,
  accessibility: ElementDefinition["accessibility"] = {},
  references?: (props: Props) => readonly ResourceReference[],
): ElementDefinition {
  return defineElement({
    type,
    version: 1,
    label,
    props: propsSchema,
    defaults: () => structuredClone(defaults),
    controls: Object.keys(defaults).map((key) => ({
      key,
      label: key
        .replace(
          /(^|-)([a-z])/gu,
          (_match, _prefix, letter: string) => ` ${letter.toUpperCase()}`,
        )
        .trim(),
    })),
    childPolicy,
    styles: allStyles,
    accessibility,
    render,
    ...(references ? { references } : {}),
  });
}

const text = (props: Props, key: string, fallback = "") =>
  typeof props[key] === "string" ? props[key] : fallback;
const number = (props: Props, key: string, fallback = 0) =>
  typeof props[key] === "number" ? props[key] : fallback;
const node = (
  tag: string,
  attributes: Readonly<Record<string, string | number | boolean | undefined>>,
  childNodes: readonly RenderNode[] = [],
): RenderElement => ({ tag, attributes, children: childNodes });
const resourceReference = (props: Props): ResourceReference | null => {
  const value = props.resource;
  return value &&
    typeof value === "object" &&
    typeof (value as { kind?: unknown }).kind === "string"
    ? (value as ResourceReference)
    : null;
};
const mediaReferences = (props: Props) => {
  const reference = resourceReference(props);
  return reference ? [reference] : [];
};
const mediaUrl = (
  props: Props,
  resource: (reference: ResourceReference) => string | null,
) => {
  const reference = resourceReference(props);
  return reference
    ? (resource(reference) ?? undefined)
    : text(props, "src") || undefined;
};

export const standardElements: readonly ElementDefinition[] = Object.freeze([
  element(
    "container",
    "Container",
    {},
    (_props, context) => node("div", {}, context.children),
    children,
  ),
  element(
    "heading",
    "Heading",
    { text: "Heading", level: 2 },
    (props) =>
      node(`h${Math.min(6, Math.max(1, number(props, "level", 2)))}`, {}, [
        text(props, "text", "Heading"),
      ]),
    none,
    { role: "heading" },
  ),
  element("text", "Text", { text: "Text" }, (props) =>
    node("p", {}, [text(props, "text", "Text")]),
  ),
  element(
    "button",
    "Button / link",
    { label: "Button", href: "#" },
    (props) =>
      node(
        "a",
        { href: text(props, "href", "#"), "data-pagebldr-action": "activate" },
        [text(props, "label", "Button")],
      ),
    none,
    { keyboardInteractive: true, requiresLabel: true },
  ),
  element(
    "image",
    "Image",
    { src: "", alt: "" },
    (props, context) =>
      node("img", {
        src: mediaUrl(props, context.resource),
        alt: text(props, "alt"),
      }),
    none,
    { requiresLabel: true },
    mediaReferences,
  ),
  element(
    "video",
    "Video",
    { src: "", title: "Video" },
    (props, context) =>
      node("video", {
        src: mediaUrl(props, context.resource),
        title: text(props, "title", "Video"),
        controls: true,
      }),
    none,
    { requiresLabel: true, keyboardInteractive: true },
    mediaReferences,
  ),
  element("icon", "Icon", { label: "", glyph: "•" }, (props) =>
    node(
      "span",
      text(props, "label")
        ? { role: "img", "aria-label": text(props, "label") }
        : { "aria-hidden": true },
      [text(props, "glyph", "•")],
    ),
  ),
  element("divider", "Divider", {}, () => node("hr", {})),
  element("spacer", "Spacer", {}, () => node("div", { "aria-hidden": true })),
  element("list", "List", { items: [] }, (props) =>
    node(
      "ul",
      {},
      (Array.isArray(props.items) ? props.items : []).map((item) =>
        node("li", {}, [String(item)]),
      ),
    ),
  ),
  element(
    "accordion",
    "Accordion",
    { summary: "Details" },
    (props, context) =>
      node("details", {}, [
        node("summary", {}, [text(props, "summary", "Details")]),
        ...context.children,
      ]),
    children,
    { keyboardInteractive: true },
  ),
  element(
    "tabs",
    "Tabs",
    { label: "Tabs" },
    (_props, context) =>
      node("div", { role: "tablist", "aria-label": "Tabs" }, context.children),
    children,
    { role: "tablist", requiresLabel: true, keyboardInteractive: true },
  ),
  element("testimonial", "Testimonial", { quote: "", author: "" }, (props) =>
    node("figure", {}, [
      node("blockquote", {}, [text(props, "quote")]),
      node("figcaption", {}, [text(props, "author")]),
    ]),
  ),
  element(
    "rating",
    "Rating",
    { value: 5, maximum: 5 },
    (props) =>
      node(
        "div",
        {
          role: "img",
          "aria-label": `${number(props, "value", 5)} out of ${number(props, "maximum", 5)} stars`,
        },
        ["★".repeat(Math.max(0, number(props, "value", 5)))],
      ),
    none,
    { role: "img", requiresLabel: true },
  ),
  element("counter", "Counter", { value: 0, label: "" }, (props) =>
    node("data", { value: number(props, "value") }, [
      text(props, "label"),
      String(number(props, "value")),
    ]),
  ),
  element(
    "countdown",
    "Countdown",
    { datetime: "", label: "Countdown" },
    (props) =>
      node(
        "time",
        {
          dateTime: text(props, "datetime"),
          "aria-label": text(props, "label", "Countdown"),
        },
        [text(props, "datetime")],
      ),
  ),
  element(
    "social-links",
    "Social links",
    { label: "Social links" },
    (_props, context) =>
      node("nav", { "aria-label": "Social links" }, context.children),
    children,
    { role: "navigation", requiresLabel: true },
  ),
  element(
    "logo-cloud",
    "Logo cloud",
    { label: "Logos" },
    (_props, context) =>
      node("section", { "aria-label": "Logos" }, context.children),
    children,
    { requiresLabel: true },
  ),
  element(
    "gallery",
    "Gallery",
    { label: "Gallery" },
    (_props, context) =>
      node("div", { role: "list", "aria-label": "Gallery" }, context.children),
    children,
    { role: "list", requiresLabel: true },
  ),
]);
