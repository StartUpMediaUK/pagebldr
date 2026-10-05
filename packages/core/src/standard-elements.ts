import { z } from "zod";

import {
  defineElement,
  type ElementControl,
  type ElementDefinition,
  type ElementInlineEditing,
  type ElementRenderContext,
  type RenderElement,
  type RenderNode,
} from "./element.js";
import { defineStyleCapability } from "./styles.js";
import { PagebldrError, type ResourceReference } from "./types.js";

type Props = Readonly<Record<string, unknown>>;

const anchorId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
  .optional();
const authoredId = z.string().min(1).max(128);
const safeHttpUrl = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const referenceSchema = z
  .object({ kind: z.string().min(1), value: z.unknown() })
  .strict();
const imageSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("external"), url: safeHttpUrl }).strict(),
  z
    .object({ type: z.literal("resource"), reference: referenceSchema })
    .strict(),
]);
const mediaSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("external"), url: safeHttpUrl }).strict(),
  z
    .object({
      type: z.literal("resource"),
      reference: referenceSchema,
      presentation: z.enum(["native", "embed"]).optional(),
    })
    .strict(),
]);
const destinationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("external"),
      url: safeHttpUrl,
      newTab: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("anchor"), elementId: authoredId }).strict(),
  z
    .object({
      type: z.literal("email"),
      address: z.string().email().max(320),
      subject: z.string().max(300).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("telephone"),
      number: z
        .string()
        .min(3)
        .max(40)
        .regex(/^\+?[0-9 ().-]+$/u),
    })
    .strict(),
  z
    .object({
      type: z.literal("application"),
      reference: referenceSchema,
      newTab: z.boolean().optional(),
    })
    .strict(),
]);
const iconNames = [
  "sparkles",
  "activity",
  "check",
  "arrow-right",
  "star",
  "heart",
  "shield",
  "target",
  "users",
  "chart",
  "clock",
  "mail",
  "play",
] as const;
const iconName = z.enum(iconNames);
const socialPlatforms = [
  "linkedin",
  "instagram",
  "facebook",
  "youtube",
  "x",
  "website",
] as const;
const colorValue = z.union([
  z.string().regex(/^#[0-9a-fA-F]{6}$/u),
  z
    .object({ type: z.literal("variable"), variableId: z.string().min(1) })
    .strict(),
]);

export const standardStyleCapabilities = Object.freeze([
  defineStyleCapability({
    key: "layout",
    label: "Layout",
    properties: [
      "display",
      "flex",
      "flexBasis",
      "flexDirection",
      "flexGrow",
      "flexShrink",
      "flexWrap",
      "alignContent",
      "alignItems",
      "alignSelf",
      "justifyContent",
      "justifyItems",
      "justifySelf",
      "gap",
      "columnGap",
      "rowGap",
      "gridAutoColumns",
      "gridAutoFlow",
      "gridAutoRows",
      "gridColumn",
      "gridRow",
      "gridTemplateColumns",
      "gridTemplateRows",
      "order",
    ],
  }),
  defineStyleCapability({
    key: "spacing",
    label: "Spacing",
    properties: [
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ],
  }),
  defineStyleCapability({
    key: "size",
    label: "Size",
    properties: [
      "width",
      "minWidth",
      "maxWidth",
      "height",
      "minHeight",
      "maxHeight",
      "aspectRatio",
      "objectFit",
      "objectPosition",
      "overflow",
      "overflowX",
      "overflowY",
    ],
  }),
  defineStyleCapability({
    key: "position",
    label: "Position",
    properties: ["position", "top", "right", "bottom", "left", "zIndex"],
  }),
  defineStyleCapability({
    key: "typography",
    label: "Typography",
    properties: [
      "color",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "textAlign",
      "textDecoration",
      "textTransform",
      "verticalAlign",
      "whiteSpace",
      "wordBreak",
    ],
  }),
  defineStyleCapability({
    key: "background",
    label: "Background",
    properties: [
      "background",
      "backgroundColor",
      "backgroundImage",
      "backgroundPosition",
      "backgroundRepeat",
      "backgroundSize",
    ],
  }),
  defineStyleCapability({
    key: "border",
    label: "Border",
    properties: [
      "border",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderColor",
      "borderRadius",
      "borderStyle",
      "borderWidth",
      "outline",
      "outlineOffset",
    ],
  }),
  defineStyleCapability({
    key: "effects",
    label: "Effects",
    properties: [
      "backdropFilter",
      "boxShadow",
      "cursor",
      "filter",
      "opacity",
      "transform",
      "transformOrigin",
      "transition",
    ],
  }),
  defineStyleCapability({
    key: "responsive-visibility",
    label: "Responsive visibility",
    properties: ["display", "visibility"],
  }),
]);

const allStyles = standardStyleCapabilities.map(({ key }) => key);
const mediaStyles = allStyles.filter((key) => key !== "typography");
const none = { kind: "none" } as const;

function label(key: string) {
  return key
    .replace(/([A-Z])/gu, " $1")
    .replace(/^./u, (value) => value.toUpperCase());
}

function definition(config: {
  type: string;
  version?: number;
  label: string;
  schema: z.AnyZodObject;
  defaults: Props;
  render: (props: Props, context: ElementRenderContext) => RenderNode;
  childPolicy?: ElementDefinition["childPolicy"];
  controls?: readonly ElementControl<Props>[];
  styleControls?: readonly ElementControl<Props>[];
  styles?: readonly string[];
  accessibility?: ElementDefinition["accessibility"];
  inlineEditing?: ElementInlineEditing<Props>;
  migrate?: (props: unknown, fromVersion: number) => Props;
  references?: (props: Props) => readonly ResourceReference[];
  destinations?: (props: Props) => readonly unknown[];
}): ElementDefinition {
  const schema = config.schema.extend({ anchorId }).strict();
  return defineElement({
    type: config.type,
    version: config.version ?? 1,
    label: config.label,
    props: schema,
    defaults: () => structuredClone(config.defaults),
    controls: config.controls ?? scalarControls(config.defaults),
    ...(config.styleControls ? { styleControls: config.styleControls } : {}),
    childPolicy: config.childPolicy ?? none,
    styles: config.styles ?? allStyles,
    accessibility: config.accessibility ?? {},
    ...(config.inlineEditing ? { inlineEditing: config.inlineEditing } : {}),
    render: config.render,
    ...(config.migrate ? { migrate: config.migrate } : {}),
    ...(config.references ? { references: config.references } : {}),
    ...(config.destinations ? { destinations: config.destinations } : {}),
  });
}

function scalarControls(defaults: Props): readonly ElementControl<Props>[] {
  const controls: ElementControl<Props>[] = [];
  for (const [key, value] of Object.entries(defaults)) {
    const base = { key, label: label(key) };
    if (typeof value === "string") controls.push({ ...base, kind: "text" });
    if (typeof value === "number") controls.push({ ...base, kind: "number" });
    if (typeof value === "boolean") controls.push({ ...base, kind: "boolean" });
  }
  return controls;
}

const text = (props: Props, key: string, fallback = "") =>
  typeof props[key] === "string" ? props[key] : fallback;
const number = (props: Props, key: string, fallback = 0) =>
  typeof props[key] === "number" ? props[key] : fallback;
const boolean = (props: Props, key: string, fallback = false) =>
  typeof props[key] === "boolean" ? props[key] : fallback;
const array = (props: Props, key: string) =>
  Array.isArray(props[key]) ? (props[key] as Props[]) : [];
const node = (
  tag: string,
  attributes: RenderElement["attributes"] = {},
  children: readonly RenderNode[] = [],
  style?: RenderElement["style"],
): RenderElement => ({
  tag,
  attributes,
  children,
  ...(style ? { style } : {}),
});

function sourceUrl(source: unknown, context: ElementRenderContext) {
  if (!source || typeof source !== "object") return null;
  const value = source as {
    type?: string;
    url?: string;
    reference?: ResourceReference;
  };
  if (value.type === "external") return value.url ?? null;
  return value.type === "resource" && value.reference
    ? context.resource(value.reference)
    : null;
}

function sourceReferences(sources: readonly unknown[]) {
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const value = source as { type?: string; reference?: ResourceReference };
    return value.type === "resource" && value.reference
      ? [value.reference]
      : [];
  });
}

function linkAttributes(context: ElementRenderContext, destination: unknown) {
  const resolved = context.destination(destination);
  return {
    href: context.mode === "edit" ? undefined : (resolved.href ?? undefined),
    "aria-disabled": resolved.href ? undefined : true,
    rel: resolved.newTab ? "noopener noreferrer" : undefined,
    target: resolved.newTab ? "_blank" : undefined,
  } as const;
}

function migrationError(type: string, version: number): never {
  throw new PagebldrError(
    "MIGRATION_MISSING",
    `No ${type} migration exists from Element version ${version}.`,
  );
}

const imageV1 = z
  .object({ src: safeHttpUrl, alt: z.string().max(500), anchorId })
  .strict();
const videoV1 = z
  .object({ src: safeHttpUrl, title: z.string().min(1).max(300), anchorId })
  .strict();
const progressSchema = z
  .object({
    value: z.number().finite().min(0).max(100),
    label: z.string().min(1).max(300),
    showLabel: z.boolean(),
    showValue: z.boolean(),
    trackColor: colorValue,
    indicatorColor: colorValue,
    thickness: z.number().int().min(1).max(64),
    radius: z.number().int().min(0).max(999),
  })
  .strict();

export const standardElements: readonly ElementDefinition[] = Object.freeze([
  definition({
    type: "container",
    label: "Container",
    schema: z.object({
      tag: z.enum([
        "div",
        "main",
        "section",
        "article",
        "header",
        "footer",
        "nav",
      ]),
      layout: z.enum(["flex", "grid"]),
    }),
    defaults: { tag: "div", layout: "flex" },
    childPolicy: { kind: "any" },
    render: (props, context) =>
      node(text(props, "tag", "div"), {}, context.children),
  }),
  definition({
    type: "heading",
    label: "Heading",
    schema: z.object({
      content: z.string().max(2_000),
      level: z.number().int().min(1).max(6),
    }),
    defaults: { content: "A clear, compelling heading", level: 2 },
    controls: [
      { kind: "text", key: "content", label: "Content" },
      {
        kind: "select",
        key: "level",
        label: "Level",
        options: [1, 2, 3, 4, 5, 6].map((value) => ({
          label: `Heading ${value}`,
          value,
        })),
      },
    ],
    accessibility: { role: "heading" },
    inlineEditing: {
      property: "content",
      read: (props) => text(props, "content"),
      update: (value) => ({ content: value }),
    },
    render: (props) =>
      node(`h${number(props, "level", 2)}`, { tabIndex: -1 }, [
        text(props, "content"),
      ]),
  }),
  definition({
    type: "rich-text",
    label: "Rich Text",
    schema: z.object({
      content: z.array(
        z
          .object({
            type: z.enum(["paragraph", "heading", "bullet", "numbered"]),
            text: z.string().max(10_000),
          })
          .strict(),
      ),
    }),
    defaults: {
      content: [{ type: "paragraph", text: "Add your supporting copy." }],
    },
    controls: [
      {
        kind: "rich-text",
        key: "content",
        label: "Content",
        defaultBlock: { type: "paragraph", text: "" },
        blockTypes: [
          { label: "Paragraph", value: "paragraph" },
          { label: "Heading", value: "heading" },
          { label: "Bulleted list", value: "bullet" },
          { label: "Numbered list", value: "numbered" },
        ],
      },
    ],
    inlineEditing: {
      property: "content",
      read: (props) =>
        array(props, "content")
          .map((block) => text(block, "text"))
          .join("\n"),
      update: (value, props) => {
        const existing = array(props, "content");
        return {
          content: value.split(/\r?\n/u).map((line, index) => ({
            type: text(existing[index] ?? {}, "type", "paragraph"),
            text: line,
          })),
        };
      },
    },
    render: (props) => renderRichText(array(props, "content")),
  }),
  definition({
    type: "button",
    label: "Button",
    schema: z.object({
      label: z.string().min(1).max(200),
      destination: destinationSchema,
    }),
    defaults: {
      label: "Learn more",
      destination: {
        type: "external",
        url: "https://example.com",
        newTab: false,
      },
    },
    controls: [
      { kind: "text", key: "label", label: "Label" },
      { kind: "destination", key: "destination", label: "Destination" },
    ],
    accessibility: { keyboardInteractive: true, requiresLabel: true },
    destinations: (props) => [props.destination],
    references: (props) => destinationReferences([props.destination]),
    render: (props, context) =>
      node(
        "a",
        {
          ...linkAttributes(context, props.destination),
          className: "pagebldr-button",
        },
        [text(props, "label", "Button")],
      ),
  }),
  definition({
    type: "logo",
    label: "Logo",
    schema: z.object({
      display: z.enum(["text", "image", "image-text"]),
      text: z.string().min(1).max(200),
      source: imageSourceSchema,
      alt: z.string().max(500),
      imagePosition: z.enum(["before", "after"]),
      gap: z.number().int().min(0).max(96),
      alignment: z.enum(["start", "center", "end"]),
      imageWidth: z.number().int().min(16).max(600),
      imageFit: z.enum(["contain", "cover"]),
    }),
    defaults: {
      display: "text",
      text: "Your Brand",
      source: {
        type: "external",
        url: "https://placehold.co/240x80/f4f4f5/171717?text=Your+Brand",
      },
      alt: "Your Brand",
      imagePosition: "before",
      gap: 12,
      alignment: "center",
      imageWidth: 120,
      imageFit: "contain",
    },
    controls: [
      {
        kind: "select",
        key: "display",
        label: "Logo display",
        options: [
          { label: "Text", value: "text" },
          { label: "Image", value: "image" },
          { label: "Image and text", value: "image-text" },
        ],
      },
      {
        kind: "text",
        key: "text",
        label: "Logo text",
        visibleWhen: { key: "display", notEquals: "image" },
      },
      {
        kind: "text",
        key: "alt",
        label: "Alternative text",
        visibleWhen: { key: "display", notEquals: "text" },
      },
    ],
    styleControls: [
      {
        kind: "number",
        key: "imageWidth",
        label: "Image width",
        min: 16,
        max: 600,
        step: 1,
        visibleWhen: { key: "display", notEquals: "text" },
      },
      {
        kind: "select",
        key: "imageFit",
        label: "Image fit",
        visibleWhen: { key: "display", notEquals: "text" },
        options: [
          { label: "Contain", value: "contain" },
          { label: "Cover", value: "cover" },
        ],
      },
      {
        kind: "select",
        key: "imagePosition",
        label: "Image position",
        visibleWhen: { key: "display", equals: "image-text" },
        options: [
          { label: "Before text", value: "before" },
          { label: "After text", value: "after" },
        ],
      },
      {
        kind: "number",
        key: "gap",
        label: "Image gap",
        min: 0,
        max: 96,
        step: 1,
        visibleWhen: { key: "display", equals: "image-text" },
      },
      {
        kind: "select",
        key: "alignment",
        label: "Alignment",
        presentation: "segmented",
        visibleWhen: { key: "display", equals: "image-text" },
        options: [
          { label: "Start", value: "start" },
          { label: "Centre", value: "center" },
          { label: "End", value: "end" },
        ],
      },
    ],
    references: (props) => sourceReferences([props.source]),
    render: renderLogo,
  }),
  definition({
    type: "menu",
    label: "Menu",
    schema: z.object({
      ariaLabel: z.string().min(1).max(200),
      collapseAt: z.enum(["desktop", "mobile", "tablet", "never"]),
      presentation: z.enum(["dropdown", "fullscreen"]),
      toggleLabel: z.string().min(1).max(120),
      panelBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/u),
      panelPadding: z.number().int().min(0).max(160),
      itemGap: z.number().int().min(0).max(96).optional(),
      itemAlignment: z.enum(["start", "center", "end"]).optional(),
      fullscreenVerticalAlignment: z
        .enum(["start", "center", "end"])
        .optional(),
      itemAppearance: z.enum(["underline", "background"]).optional(),
      itemBackground: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/u)
        .optional(),
      itemHoverBackground: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/u)
        .optional(),
      breakpointPosition: z.enum(["none", "start", "center", "end"]).optional(),
      items: z
        .array(
          z
            .object({
              id: authoredId,
              label: z.string().min(1).max(200),
              destination: destinationSchema,
            })
            .strict(),
        )
        .min(1)
        .max(30),
    }),
    defaults: menuDefaults(),
    controls: [
      {
        kind: "select",
        key: "collapseAt",
        label: "Menu breakpoint",
        presentation: "viewport",
        options: [
          { label: "Desktop", value: "desktop" },
          { label: "Tablet", value: "tablet" },
          { label: "Mobile", value: "mobile" },
          { label: "No breakpoint", value: "never" },
        ],
      },
      {
        kind: "select",
        key: "presentation",
        label: "Collapse style",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
        options: [
          { label: "Full-width dropdown", value: "dropdown" },
          { label: "Full screen", value: "fullscreen" },
        ],
      },
      {
        kind: "select",
        key: "breakpointPosition",
        label: "On breakpoint",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
        options: [
          { label: "Leave in place", value: "none" },
          { label: "Move to start", value: "start" },
          { label: "Move to center", value: "center" },
          { label: "Move to end", value: "end" },
        ],
      },
      {
        kind: "collection",
        key: "items",
        label: "Links",
        itemLabel: "Link",
        minItems: 1,
        maxItems: 30,
        idKey: "id",
        idPrefix: "menu-item",
        defaultItem: {
          label: "New link",
          destination: {
            type: "external",
            url: "https://example.com",
            newTab: false,
          },
        },
        itemControls: [
          { kind: "text", key: "label", label: "Label" },
          {
            kind: "destination",
            key: "destination",
            label: "Destination",
            preferFirstAnchor: true,
          },
        ],
      },
    ],
    styleControls: [
      {
        kind: "select",
        key: "itemAlignment",
        label: "Menu items align",
        labelWhen: [
          {
            label: "Horizontal alignment",
            conditions: [
              { key: "collapseAt", notEquals: "never" },
              { key: "presentation", equals: "fullscreen" },
            ],
          },
        ],
        presentation: "horizontal-alignment",
        options: [
          { label: "Start", value: "start" },
          { label: "Centre", value: "center" },
          { label: "End", value: "end" },
        ],
      },
      {
        kind: "select",
        key: "fullscreenVerticalAlignment",
        label: "Vertical alignment",
        presentation: "vertical-alignment",
        visibleWhen: [
          { key: "collapseAt", notEquals: "never" },
          { key: "presentation", equals: "fullscreen" },
        ],
        options: [
          { label: "Top", value: "start" },
          { label: "Middle", value: "center" },
          { label: "Bottom", value: "end" },
        ],
      },
      {
        kind: "select",
        key: "itemAppearance",
        label: "Item appearance",
        presentation: "segmented",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
        options: [
          { label: "Underline", value: "underline" },
          { label: "Background", value: "background" },
        ],
      },
      {
        kind: "text",
        key: "itemBackground",
        label: "Item background",
        visibleWhen: [
          { key: "collapseAt", notEquals: "never" },
          { key: "itemAppearance", equals: "background" },
        ],
      },
      {
        kind: "text",
        key: "itemHoverBackground",
        label: "Item hover background",
        visibleWhen: [
          { key: "collapseAt", notEquals: "never" },
          { key: "itemAppearance", equals: "background" },
        ],
      },
      {
        kind: "number",
        key: "itemGap",
        label: "Space between",
        presentation: "slider",
        unit: "px",
        min: 0,
        max: 96,
        step: 1,
      },
      {
        kind: "text",
        key: "panelBackground",
        label: "Menu background",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
      },
      {
        kind: "number",
        key: "panelPadding",
        label: "Open panel padding",
        min: 0,
        max: 160,
        step: 1,
        visibleWhen: { key: "collapseAt", notEquals: "never" },
      },
    ],
    destinations: (props) =>
      array(props, "items").map((item) => item.destination),
    references: (props) =>
      destinationReferences(
        array(props, "items").map((item) => item.destination),
      ),
    render: renderMenu,
  }),
  definition({
    type: "copyright",
    label: "Copyright",
    schema: z.object({
      showSymbol: z.boolean(),
      showYear: z.boolean(),
      owner: z.string().min(1).max(200),
      suffix: z.string().max(300),
    }),
    defaults: {
      showSymbol: true,
      showYear: true,
      owner: "Your Brand",
      suffix: "All rights reserved.",
    },
    render: (props, context) => {
      const year = String(context.now.getFullYear());
      return node("p", { className: "pagebldr-copyright" }, [
        boolean(props, "showSymbol") ? "© " : "",
        boolean(props, "showYear")
          ? node("time", { dateTime: year }, [year])
          : "",
        boolean(props, "showYear") ? " " : "",
        text(props, "owner"),
        text(props, "suffix") ? ` ${text(props, "suffix")}` : "",
      ]);
    },
  }),
  definition({
    type: "image",
    version: 2,
    label: "Image",
    styles: mediaStyles,
    schema: z.object({
      source: imageSourceSchema,
      alt: z.string().max(500),
      altConfirmed: z.boolean(),
      decorative: z.boolean(),
      destination: destinationSchema.nullable(),
      fit: z.enum(["contain", "cover", "fill", "none", "scale-down"]),
      position: z.enum([
        "top-left",
        "top",
        "top-right",
        "left",
        "center",
        "right",
        "bottom-left",
        "bottom",
        "bottom-right",
      ]),
    }),
    defaults: {
      source: {
        type: "external",
        url: "https://images.unsplash.com/photo-1557804506-669a67965ba0",
      },
      alt: "",
      altConfirmed: false,
      decorative: false,
      destination: null,
      fit: "cover",
      position: "center",
    },
    controls: [
      { kind: "text", key: "alt", label: "Alternative text" },
      {
        kind: "boolean",
        key: "altConfirmed",
        label: "Alternative text confirmed",
      },
      { kind: "boolean", key: "decorative", label: "Decorative" },
      {
        kind: "destination",
        key: "destination",
        label: "Destination",
        nullable: true,
      },
      {
        kind: "select",
        key: "fit",
        label: "Fit",
        options: ["contain", "cover", "fill", "none", "scale-down"].map(
          (value) => ({
            label: value === "scale-down" ? "Scale down" : label(value),
            value,
          }),
        ),
      },
      {
        kind: "select",
        key: "position",
        label: "Position",
        options: [
          "top-left",
          "top",
          "top-right",
          "left",
          "center",
          "right",
          "bottom-left",
          "bottom",
          "bottom-right",
        ].map((value) => ({
          label: value === "center" ? "Centre" : label(value.replace("-", " ")),
          value,
        })),
      },
    ],
    references: (props) => [
      ...sourceReferences([props.source]),
      ...destinationReferences([props.destination]),
    ],
    destinations: (props) => (props.destination ? [props.destination] : []),
    migrate: migrateImage,
    render: renderImage,
  }),
  definition({
    type: "video",
    version: 2,
    label: "Video",
    styles: mediaStyles,
    schema: z.object({
      source: mediaSourceSchema,
      title: z.string().min(1).max(300),
    }),
    defaults: {
      source: {
        type: "external",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      title: "Video",
    },
    references: (props) => sourceReferences([props.source]),
    migrate: migrateVideo,
    render: renderVideo,
  }),
  definition({
    type: "icon",
    label: "Icon",
    schema: z.object({ name: iconName, label: z.string().max(200) }),
    defaults: { name: "sparkles", label: "" },
    render: (props) =>
      node(
        "span",
        text(props, "label")
          ? {
              role: "img",
              "aria-label": text(props, "label"),
              "data-icon-name": text(props, "name"),
            }
          : { "aria-hidden": true, "data-icon-name": text(props, "name") },
        [iconGlyph(text(props, "name"))],
      ),
  }),
  definition({
    type: "divider",
    label: "Divider",
    styles: mediaStyles,
    schema: z.object({ decorative: z.boolean() }),
    defaults: { decorative: true },
    render: (props) =>
      node("hr", { "aria-hidden": boolean(props, "decorative") || undefined }),
  }),
  definition({
    type: "spacer",
    label: "Spacer",
    styles: ["size", "responsive-visibility"],
    schema: z.object({}),
    defaults: {},
    render: () => node("div", { "aria-hidden": true }),
  }),
  definition({
    type: "list",
    label: "List",
    schema: z.object({
      ordered: z.boolean(),
      items: z.array(
        z.object({ id: authoredId, text: z.string().max(2_000) }).strict(),
      ),
    }),
    defaults: {
      ordered: false,
      items: [
        { id: "item-1", text: "First benefit" },
        { id: "item-2", text: "Second benefit" },
      ],
    },
    controls: [
      { kind: "boolean", key: "ordered", label: "Numbered list" },
      {
        kind: "collection",
        key: "items",
        label: "Items",
        itemLabel: "Item",
        idKey: "id",
        idPrefix: "list-item",
        defaultItem: { text: "New list item" },
        itemControls: [{ kind: "text", key: "text", label: "Text" }],
      },
    ],
    render: (props) =>
      node(
        boolean(props, "ordered") ? "ol" : "ul",
        {},
        array(props, "items").map((item) =>
          node("li", {}, [text(item, "text")]),
        ),
      ),
  }),
  definition({
    type: "icon-list",
    label: "Icon List",
    schema: z.object({
      items: z
        .array(
          z
            .object({
              id: authoredId,
              icon: iconName,
              text: z.string().min(1).max(2_000),
            })
            .strict(),
        )
        .min(1)
        .max(50),
    }),
    defaults: {
      items: [
        { id: "item-1", icon: "check", text: "A clear customer benefit" },
        { id: "item-2", icon: "check", text: "A specific proof point" },
        { id: "item-3", icon: "check", text: "A practical next step" },
      ],
    },
    controls: [
      {
        kind: "collection",
        key: "items",
        label: "Items",
        itemLabel: "Item",
        minItems: 1,
        maxItems: 50,
        idKey: "id",
        idPrefix: "icon-list-item",
        defaultItem: { icon: "check", text: "New list item" },
        itemControls: [
          {
            kind: "select",
            key: "icon",
            label: "Icon",
            options: iconNames.map((value) => ({
              label: label(value.replace("-", " ")),
              value,
            })),
          },
          { kind: "text", key: "text", label: "Text" },
        ],
      },
    ],
    render: (props) =>
      node(
        "ul",
        { className: "pagebldr-icon-list" },
        array(props, "items").map((item) =>
          node("li", {}, [
            node(
              "span",
              { "aria-hidden": true, "data-icon-name": text(item, "icon") },
              [iconGlyph(text(item, "icon"))],
            ),
            node("span", {}, [text(item, "text")]),
          ]),
        ),
      ),
  }),
  definition({
    type: "accordion",
    label: "Accordion / FAQ",
    schema: z.object({
      allowMultiple: z.boolean(),
      items: z
        .array(
          z
            .object({
              id: authoredId,
              question: z.string().min(1).max(500),
              answer: z.string().max(5_000),
            })
            .strict(),
        )
        .min(1)
        .max(30),
    }),
    defaults: {
      allowMultiple: false,
      items: [
        {
          id: "faq-1",
          question: "What will I learn?",
          answer: "Explain the useful outcome your visitor can expect.",
        },
        {
          id: "faq-2",
          question: "How long does it take?",
          answer: "Set a clear and honest expectation for the next step.",
        },
      ],
    },
    controls: [
      {
        kind: "boolean",
        key: "allowMultiple",
        label: "Allow multiple open",
      },
      {
        kind: "collection",
        key: "items",
        label: "Items",
        itemLabel: "Item",
        minItems: 1,
        maxItems: 30,
        idKey: "id",
        idPrefix: "accordion-item",
        defaultItem: { question: "New question", answer: "" },
        itemControls: [
          { kind: "text", key: "question", label: "Question" },
          {
            kind: "textarea",
            key: "answer",
            label: "Answer",
            allowEmpty: true,
          },
        ],
      },
    ],
    render: (props) =>
      node(
        "div",
        { className: "pagebldr-accordion" },
        array(props, "items").map((item, index) =>
          node(
            "details",
            {
              open: index === 0,
              name: boolean(props, "allowMultiple")
                ? undefined
                : "pagebldr-accordion",
            },
            [
              node("summary", {}, [text(item, "question")]),
              node("p", {}, [text(item, "answer")]),
            ],
          ),
        ),
      ),
  }),
  definition({
    type: "tabs",
    label: "Tabs",
    schema: z.object({
      items: z
        .array(
          z
            .object({
              id: authoredId,
              label: z.string().min(1).max(120),
              content: z.string().max(5_000),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    }),
    defaults: {
      items: [
        {
          id: "tab-1",
          label: "Discover",
          content: "Understand the current situation.",
        },
        {
          id: "tab-2",
          label: "Decide",
          content: "See the clearest next step.",
        },
        { id: "tab-3", label: "Act", content: "Move forward with confidence." },
      ],
    },
    controls: [
      {
        kind: "collection",
        key: "items",
        label: "Tabs",
        itemLabel: "Tab",
        minItems: 1,
        maxItems: 12,
        idKey: "id",
        idPrefix: "tab",
        defaultItem: { label: "New tab", content: "" },
        itemControls: [
          { kind: "text", key: "label", label: "Label" },
          {
            kind: "textarea",
            key: "content",
            label: "Content",
            allowEmpty: true,
          },
        ],
      },
    ],
    accessibility: { role: "tablist", keyboardInteractive: true },
    render: renderTabs,
  }),
  definition({
    type: "testimonial",
    label: "Testimonial",
    schema: z.object({
      quote: z.string().min(1).max(5_000),
      author: z.string().min(1).max(200),
      role: z.string().max(240),
      image: imageSourceSchema.nullable(),
    }),
    defaults: {
      quote: "This gave us the clarity to focus on what mattered next.",
      author: "Customer name",
      role: "Customer role",
      image: null,
    },
    references: (props) => sourceReferences([props.image]),
    render: renderTestimonial,
  }),
  definition({
    type: "star-rating",
    label: "Star Rating",
    schema: z.object({
      value: z.number().min(0).max(5).multipleOf(0.5),
      label: z.string().min(1).max(300),
    }),
    defaults: { value: 5, label: "5 out of 5 stars" },
    accessibility: { role: "img", requiresLabel: true },
    render: (props) => {
      const value = number(props, "value");
      return node(
        "span",
        {
          className: "pagebldr-star-rating",
          role: "img",
          "aria-label": text(props, "label", `${value} out of 5 stars`),
        },
        [
          Array.from({ length: 5 }, (_, index) =>
            index + 1 <= Math.round(value) ? "★" : "☆",
          ).join(""),
        ],
      );
    },
  }),
  definition({
    type: "counter",
    label: "Counter",
    schema: z.object({
      value: z.number().finite(),
      prefix: z.string().max(40),
      suffix: z.string().max(40),
      label: z.string().max(300),
    }),
    defaults: { value: 84, prefix: "", suffix: "%", label: "Completion rate" },
    render: (props) =>
      node("span", { className: "pagebldr-counter" }, [
        node("data", { value: number(props, "value") }, [
          `${text(props, "prefix")}${number(props, "value")}${text(props, "suffix")}`,
        ]),
        text(props, "label") ? node("span", {}, [text(props, "label")]) : null,
      ]),
  }),
  definition({
    type: "progress",
    version: 2,
    label: "Progress",
    schema: progressSchema,
    defaults: {
      value: 72,
      label: "Progress",
      showLabel: true,
      showValue: true,
      trackColor: "#e4e4e7",
      indicatorColor: "#18181b",
      thickness: 10,
      radius: 999,
    },
    migrate: migrateProgress,
    render: renderProgress,
  }),
  definition({
    type: "countdown",
    label: "Countdown",
    schema: z.object({
      targetDate: z.string().datetime({ offset: true }),
      expiredText: z.string().min(1).max(300),
    }),
    defaults: {
      targetDate: "2030-12-31T23:59:59.000Z",
      expiredText: "This event has started.",
    },
    render: (props) =>
      node(
        "time",
        {
          className: "pagebldr-countdown",
          dateTime: text(props, "targetDate"),
          "data-pagebldr-widget": "countdown",
          "data-expired-text": text(props, "expiredText"),
        },
        [text(props, "targetDate")],
      ),
  }),
  definition({
    type: "social-links",
    label: "Social Links",
    schema: z.object({
      links: z
        .array(
          z
            .object({
              id: authoredId,
              platform: z.enum(socialPlatforms),
              label: z.string().min(1).max(120),
              url: safeHttpUrl,
            })
            .strict(),
        )
        .min(1)
        .max(20),
      newTab: z.boolean(),
    }),
    defaults: {
      links: [
        {
          id: "social-1",
          platform: "linkedin",
          label: "LinkedIn",
          url: "https://www.linkedin.com",
        },
        {
          id: "social-2",
          platform: "instagram",
          label: "Instagram",
          url: "https://www.instagram.com",
        },
      ],
      newTab: true,
    },
    controls: [
      { kind: "boolean", key: "newTab", label: "Open in new tab" },
      {
        kind: "collection",
        key: "links",
        label: "Links",
        itemLabel: "Link",
        minItems: 1,
        maxItems: 20,
        idKey: "id",
        idPrefix: "social-link",
        defaultItem: {
          platform: "website",
          label: "Website",
          url: "https://example.com",
        },
        itemControls: [
          {
            kind: "select",
            key: "platform",
            label: "Platform",
            options: socialPlatforms.map((value) => ({
              label: value === "x" ? "X" : label(value),
              value,
            })),
          },
          { kind: "text", key: "label", label: "Label" },
          {
            kind: "text",
            key: "url",
            label: "URL",
            placeholder: "https://example.com",
          },
        ],
      },
    ],
    render: renderSocialLinks,
  }),
  definition({
    type: "logo-cloud",
    label: "Logo Cloud",
    styles: mediaStyles,
    schema: z.object({
      label: z.string().max(300),
      logos: z
        .array(
          z
            .object({
              id: authoredId,
              name: z.string().min(1).max(200),
              source: imageSourceSchema,
              alt: z.string().max(300),
            })
            .strict(),
        )
        .min(1)
        .max(30),
    }),
    defaults: logoCloudDefaults(),
    references: (props) =>
      sourceReferences(array(props, "logos").map((logo) => logo.source)),
    render: renderLogoCloud,
  }),
  definition({
    type: "gallery-carousel",
    version: 2,
    label: "Gallery / Carousel",
    styles: mediaStyles,
    schema: z.object({
      layout: z.enum(["square", "masonry", "carousel"]),
      items: z
        .array(
          z
            .object({
              id: authoredId,
              kind: z.enum(["image", "video"]),
              source: mediaSourceSchema,
              alt: z.string().max(500),
              altConfirmed: z.boolean(),
              decorative: z.boolean(),
              caption: z.string().max(500),
            })
            .strict(),
        )
        .min(1)
        .max(30),
    }),
    defaults: galleryDefaults(),
    controls: [],
    styleControls: [
      {
        kind: "select",
        key: "layout",
        label: "Gallery layout",
        presentation: "segmented",
        options: [
          { label: "Square", value: "square" },
          { label: "Masonry", value: "masonry" },
          { label: "Carousel", value: "carousel" },
        ],
      },
    ],
    references: (props) =>
      sourceReferences(array(props, "items").map((item) => item.source)),
    migrate: migrateGallery,
    render: renderGallery,
  }),
]);

function renderRichText(blocks: Props[]): RenderElement {
  const children: RenderNode[] = [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index]!;
    const type = text(block, "type", "paragraph");
    if (type === "bullet" || type === "numbered") {
      const items: RenderNode[] = [];
      while (text(blocks[index] ?? {}, "type") === type) {
        items.push(node("li", {}, [text(blocks[index]!, "text")]));
        index += 1;
      }
      children.push(node(type === "bullet" ? "ul" : "ol", {}, items));
    } else {
      children.push(
        node(type === "heading" ? "h3" : "p", {}, [text(block, "text")]),
      );
      index += 1;
    }
  }
  return node("div", { className: "pagebldr-rich-text" }, children);
}

function renderLogo(props: Props, context: ElementRenderContext) {
  const display = text(props, "display", "text");
  const src = sourceUrl(props.source, context);
  const image =
    display !== "text" && src
      ? node(
          "img",
          { src, alt: text(props, "alt") || text(props, "text", "Home") },
          [],
          {
            width: `${number(props, "imageWidth", 120)}px`,
            objectFit: text(props, "imageFit", "contain"),
          },
        )
      : null;
  const content = [
    image,
    display !== "image"
      ? node("span", { className: "pagebldr-logo-text" }, [text(props, "text")])
      : null,
  ].filter((value): value is RenderElement => value !== null);
  if (text(props, "imagePosition") === "after") content.reverse();
  return node(
    "a",
    {
      className: "pagebldr-logo",
      "aria-label":
        display === "image" ? `${text(props, "text", "Site")} home` : undefined,
    },
    content,
    {
      display: "inline-flex",
      alignItems: text(props, "alignment", "center"),
      gap: `${number(props, "gap", 12)}px`,
    },
  );
}

function menuDefaults(): Props {
  return {
    ariaLabel: "Primary navigation",
    collapseAt: "mobile",
    presentation: "dropdown",
    toggleLabel: "Open navigation",
    panelBackground: "#ffffff",
    panelPadding: 24,
    itemGap: 24,
    itemAlignment: "start",
    fullscreenVerticalAlignment: "start",
    itemAppearance: "underline",
    itemBackground: "#f4f4f5",
    itemHoverBackground: "#e4e4e7",
    breakpointPosition: "end",
    items: [
      {
        id: "menu-item-1",
        label: "About",
        destination: {
          type: "external",
          url: "https://example.com/about",
          newTab: false,
        },
      },
      {
        id: "menu-item-2",
        label: "Contact",
        destination: { type: "email", address: "hello@example.com" },
      },
    ],
  };
}

function renderMenu(props: Props, context: ElementRenderContext) {
  const panelId = context.elementId
    ? `pagebldr-${context.elementId}-panel`
    : undefined;
  return node(
    "nav",
    {
      className: "pagebldr-menu",
      "aria-label": text(props, "ariaLabel", "Navigation"),
      "data-pagebldr-widget": "menu",
      "data-collapse-at": text(props, "collapseAt", "mobile"),
      "data-presentation": text(props, "presentation", "dropdown"),
      "data-breakpoint-position": text(props, "breakpointPosition", "end"),
      "data-item-alignment": text(props, "itemAlignment", "start"),
      "data-fullscreen-vertical-alignment": text(
        props,
        "fullscreenVerticalAlignment",
        "start",
      ),
      "data-item-appearance": text(props, "itemAppearance", "underline"),
      "data-open": "false",
      "data-render-mode": context.mode,
    },
    [
      node(
        "button",
        {
          type: "button",
          className: "pagebldr-menu-toggle",
          "aria-expanded": false,
          "aria-controls": panelId,
          "aria-label": text(props, "toggleLabel", "Open navigation"),
        },
        [
          node(
            "svg",
            {
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: 2,
              "aria-hidden": true,
            },
            [
              node("path", {
                className: "pagebldr-menu-open-icon",
                d: "M4 6h16M4 12h16M4 18h16",
              }),
              node("path", {
                className: "pagebldr-menu-close-icon",
                d: "m6 6 12 12M6 18 18 6",
              }),
            ],
          ),
        ],
      ),
      node("div", { className: "pagebldr-menu-panel", id: panelId }, [
        node("div", { className: "pagebldr-menu-fullscreen-header" }, [
          node("div", { className: "pagebldr-menu-fullscreen-logo" }),
        ]),
        node(
          "ul",
          { className: "pagebldr-menu-list" },
          array(props, "items").map((item) =>
            node("li", {}, [
              node(
                "a",
                {
                  ...linkAttributes(context, item.destination),
                  className: "pagebldr-menu-link",
                },
                [text(item, "label")],
              ),
            ]),
          ),
        ),
      ]),
    ],
    {
      "--pagebldr-menu-panel-background": text(
        props,
        "panelBackground",
        "#ffffff",
      ),
      "--pagebldr-menu-panel-padding": `${number(props, "panelPadding", 24)}px`,
      "--pagebldr-menu-item-gap": `${number(props, "itemGap", 24)}px`,
      "--pagebldr-menu-item-background": text(
        props,
        "itemBackground",
        "#f4f4f5",
      ),
      "--pagebldr-menu-item-hover-background": text(
        props,
        "itemHoverBackground",
        "#e4e4e7",
      ),
    },
  );
}

function migrateImage(props: unknown, from: number): Props {
  if (from !== 1) return migrationError("image", from);
  const value = imageV1.parse(props);
  return {
    source: { type: "external", url: value.src },
    alt: value.alt,
    altConfirmed: value.alt.trim().length > 0,
    decorative: value.alt.trim().length === 0,
    destination: null,
    fit: "cover",
    position: "center",
    ...(value.anchorId ? { anchorId: value.anchorId } : {}),
  };
}

function migrateVideo(props: unknown, from: number): Props {
  if (from !== 1) return migrationError("video", from);
  const value = videoV1.parse(props);
  return {
    source: { type: "external", url: value.src },
    title: value.title,
    ...(value.anchorId ? { anchorId: value.anchorId } : {}),
  };
}

function renderImage(props: Props, context: ElementRenderContext): RenderNode {
  const src = sourceUrl(props.source, context);
  if (!src) return null;
  const image = node(
    "img",
    { src, alt: boolean(props, "decorative") ? "" : text(props, "alt") },
    [],
    {
      objectFit: text(props, "fit", "cover"),
      objectPosition: text(props, "position", "center").replace("-", " "),
    },
  );
  return props.destination && context.mode !== "edit"
    ? node("a", linkAttributes(context, props.destination), [image])
    : image;
}

function renderVideo(props: Props, context: ElementRenderContext): RenderNode {
  const src = sourceUrl(props.source, context);
  if (!src) return null;
  if (/\.(mp4|webm|ogg)(?:$|\?)/iu.test(src))
    return node("video", {
      src,
      controls: true,
      preload: "metadata",
      title: text(props, "title"),
    });
  return node("iframe", {
    src: videoEmbedUrl(src) ?? src,
    title: text(props, "title", "Video"),
    loading: "lazy",
    allowFullScreen: true,
    referrerPolicy: "strict-origin-when-cross-origin",
  });
}

function renderTabs(props: Props) {
  const items = array(props, "items");
  return node(
    "div",
    { className: "pagebldr-tabs", "data-pagebldr-widget": "tabs" },
    [
      node(
        "div",
        { role: "tablist", className: "pagebldr-tabs-list" },
        items.map((item, index) =>
          node(
            "button",
            {
              type: "button",
              role: "tab",
              "data-tab-id": text(item, "id"),
              "aria-selected": index === 0,
              tabIndex: index === 0 ? 0 : -1,
            },
            [text(item, "label")],
          ),
        ),
      ),
      ...items.map((item, index) =>
        node(
          "div",
          {
            role: "tabpanel",
            "data-tab-panel": text(item, "id"),
            hidden: index === 0 ? undefined : true,
          },
          [text(item, "content")],
        ),
      ),
    ],
  );
}

function renderTestimonial(props: Props, context: ElementRenderContext) {
  const src = sourceUrl(props.image, context);
  return node("figure", { className: "pagebldr-testimonial" }, [
    node("blockquote", {}, [`“${text(props, "quote")}”`]),
    node("figcaption", {}, [
      src ? node("img", { src, alt: "" }) : null,
      node("span", {}, [
        node("strong", {}, [text(props, "author")]),
        text(props, "role") ? ` — ${text(props, "role")}` : "",
      ]),
    ]),
  ]);
}

function migrateProgress(props: unknown, from: number): Props {
  if (from !== 1) return migrationError("progress", from);
  const value = progressSchema
    .partial({ thickness: true, radius: true })
    .extend({ anchorId })
    .parse(props);
  return {
    ...value,
    thickness: value.thickness ?? 10,
    radius: value.radius ?? 999,
  };
}

function renderProgress(props: Props) {
  const value = Math.max(0, Math.min(100, number(props, "value")));
  const labelValue = text(props, "label", "Progress");
  return node("div", { className: "pagebldr-progress" }, [
    boolean(props, "showLabel") || boolean(props, "showValue")
      ? node("div", { className: "pagebldr-progress-meta" }, [
          boolean(props, "showLabel") ? labelValue : "",
          boolean(props, "showValue") ? `${value}%` : "",
        ])
      : null,
    node(
      "progress",
      {
        max: 100,
        value,
        "aria-label": labelValue,
        "aria-valuetext": `${value}%`,
      },
      [],
      {
        accentColor:
          typeof props.indicatorColor === "string"
            ? props.indicatorColor
            : "currentColor",
        height: `${number(props, "thickness", 10)}px`,
        borderRadius: `${number(props, "radius", 999)}px`,
      },
    ),
  ]);
}

function renderSocialLinks(props: Props, context: ElementRenderContext) {
  return node(
    "ul",
    { className: "pagebldr-social-links" },
    array(props, "links").map((item) =>
      node("li", {}, [
        node(
          "a",
          {
            href: context.mode === "edit" ? undefined : text(item, "url"),
            rel: boolean(props, "newTab") ? "noopener noreferrer" : undefined,
            target: boolean(props, "newTab") ? "_blank" : undefined,
          },
          [
            node("span", { "aria-hidden": true }, [
              iconGlyph(text(item, "platform")),
            ]),
            node("span", {}, [text(item, "label")]),
          ],
        ),
      ]),
    ),
  );
}

function logoCloudDefaults(): Props {
  return {
    label: "Trusted by ambitious teams",
    logos: [
      {
        id: "logo-1",
        name: "Partner one",
        source: {
          type: "external",
          url: "https://placehold.co/180x64/f4f4f5/52525b?text=Partner+One",
        },
        alt: "Partner one",
      },
      {
        id: "logo-2",
        name: "Partner two",
        source: {
          type: "external",
          url: "https://placehold.co/180x64/f4f4f5/52525b?text=Partner+Two",
        },
        alt: "Partner two",
      },
      {
        id: "logo-3",
        name: "Partner three",
        source: {
          type: "external",
          url: "https://placehold.co/180x64/f4f4f5/52525b?text=Partner+Three",
        },
        alt: "Partner three",
      },
    ],
  };
}

function renderLogoCloud(props: Props, context: ElementRenderContext) {
  return node("div", { className: "pagebldr-logo-cloud" }, [
    text(props, "label") ? node("p", {}, [text(props, "label")]) : null,
    ...array(props, "logos").map((logo) => {
      const src = sourceUrl(logo.source, context);
      return src
        ? node("img", {
            src,
            alt: text(logo, "alt") || text(logo, "name"),
            loading: "lazy",
          })
        : null;
    }),
  ]);
}

function galleryDefaults(): Props {
  return {
    layout: "square",
    items: [
      {
        id: "gallery-1",
        kind: "image",
        source: {
          type: "external",
          url: "https://images.unsplash.com/photo-1556761175-b413da4baf72",
        },
        alt: "People collaborating around a table",
        altConfirmed: true,
        decorative: false,
        caption: "Work together with clarity",
      },
      {
        id: "gallery-2",
        kind: "image",
        source: {
          type: "external",
          url: "https://images.unsplash.com/photo-1521737711867-e3b97375f902",
        },
        alt: "Team in a bright workspace",
        altConfirmed: true,
        decorative: false,
        caption: "Turn insight into action",
      },
      {
        id: "gallery-3",
        kind: "image",
        source: {
          type: "external",
          url: "https://images.unsplash.com/photo-1552664730-d307ca884978",
        },
        alt: "Workshop session",
        altConfirmed: true,
        decorative: false,
        caption: "Create a shared plan",
      },
    ],
  };
}

function migrateGallery(props: unknown, from: number): Props {
  if (from !== 1) return migrationError("gallery-carousel", from);
  const value = z
    .object({
      mode: z.enum(["gallery", "carousel"]),
      images: z
        .array(
          z
            .object({
              id: authoredId,
              source: imageSourceSchema,
              alt: z.string().max(500),
              caption: z.string().max(500),
            })
            .strict(),
        )
        .min(1)
        .max(30),
      anchorId,
    })
    .strict()
    .parse(props);
  return {
    layout: value.mode === "carousel" ? "carousel" : "square",
    items: value.images.map((image) => ({
      ...image,
      kind: "image",
      altConfirmed: image.alt.trim().length > 0,
      decorative: image.alt.trim().length === 0,
    })),
    ...(value.anchorId ? { anchorId: value.anchorId } : {}),
  };
}

function renderGallery(props: Props, context: ElementRenderContext) {
  const carousel = text(props, "layout") === "carousel";
  const slides = array(props, "items").map((item, index) => {
    const src = sourceUrl(item.source, context);
    if (!src) return null;
    const media =
      text(item, "kind") === "video"
        ? node("video", { src, controls: true, preload: "metadata" })
        : node("img", {
            src,
            alt: boolean(item, "decorative") ? "" : text(item, "alt"),
            loading: index === 0 ? "eager" : "lazy",
          });
    return node(
      "figure",
      {
        "data-gallery-slide": index,
        hidden: carousel && index > 0 ? true : undefined,
      },
      [
        media,
        text(item, "caption")
          ? node("figcaption", {}, [text(item, "caption")])
          : null,
      ],
    );
  });
  return node(
    "div",
    {
      className: "pagebldr-gallery",
      "data-layout": text(props, "layout", "square"),
      "data-pagebldr-widget": carousel ? "gallery" : undefined,
    },
    [
      ...slides,
      ...(carousel
        ? [
            node("div", { className: "pagebldr-gallery-controls" }, [
              node(
                "button",
                {
                  type: "button",
                  "data-gallery-action": "previous",
                  "aria-label": "Previous slide",
                },
                ["←"],
              ),
              node(
                "button",
                {
                  type: "button",
                  "data-gallery-action": "next",
                  "aria-label": "Next slide",
                },
                ["→"],
              ),
            ]),
          ]
        : []),
    ],
  );
}

function destinationReferences(destinations: readonly unknown[]) {
  return destinations.flatMap((destination) => {
    if (!destination || typeof destination !== "object") return [];
    const value = destination as {
      type?: string;
      reference?: ResourceReference;
    };
    return value.type === "application" && value.reference
      ? [value.reference]
      : [];
  });
}

function videoEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").find(Boolean);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    ) {
      const id =
        url.searchParams.get("v") ??
        url.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (["vimeo.com", "www.vimeo.com"].includes(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function iconGlyph(name: string): string {
  return (
    (
      {
        check: "✓",
        star: "★",
        heart: "♥",
        mail: "✉",
        play: "▶",
        clock: "◷",
        "arrow-right": "→",
        activity: "⌁",
        shield: "◆",
        target: "◎",
        users: "●",
        chart: "▥",
        sparkles: "✦",
      } as Record<string, string>
    )[name] ?? "•"
  );
}
