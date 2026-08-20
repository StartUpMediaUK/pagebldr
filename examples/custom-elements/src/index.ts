import {
  createPagebldr,
  defineBlock,
  defineElement,
  defineStyleCapability,
  defineTemplate,
  standardElements,
  standardStyleCapabilities,
  type StandardSchemaV1,
} from "pagebldr";

interface CardProps extends Record<string, unknown> {
  readonly title: string;
  readonly assetId: string;
}

const cardSchema: StandardSchemaV1<unknown, CardProps> = {
  "~standard": {
    version: 1,
    vendor: "custom-elements-example",
    validate: (value) =>
      value && typeof value === "object"
        ? { value: value as CardProps }
        : { issues: [{ message: "Card properties must be an object." }] },
  },
};

export const emphasisStyle = defineStyleCapability({
  key: "emphasis",
  label: "Emphasis",
  properties: ["background", "border", "box-shadow"],
});

export const cardElement = defineElement({
  type: "example-card",
  version: 2,
  label: "Example card",
  props: cardSchema,
  defaults: () => ({ title: "Card title", assetId: "hero.jpg" }),
  controls: [
    { key: "title", label: "Title" },
    { key: "assetId", label: "Asset" },
  ],
  childPolicy: { kind: "none" },
  styles: [emphasisStyle.key],
  migrate: (props, fromVersion) => {
    const legacy = props as {
      readonly heading?: string;
      readonly assetId?: string;
    };
    return {
      title:
        fromVersion === 1 ? (legacy.heading ?? "Card title") : "Card title",
      assetId: legacy.assetId ?? "hero.jpg",
    };
  },
  references: ({ assetId }) => [{ kind: "asset", value: assetId }],
  render: ({ title, assetId }, context) => ({
    tag: "article",
    children: [
      { tag: "h2", children: [title] },
      {
        tag: "img",
        attributes: {
          src: context.resource({ kind: "asset", value: assetId }) ?? "",
          alt: "",
        },
      },
    ],
  }),
});

export const heroBlock = defineBlock({
  key: "example-hero",
  label: "Example hero",
  create: () => ({ type: "example-card", props: cardElement.defaults() }),
});

export const landingTemplate = defineTemplate({
  key: "example-landing",
  label: "Example landing page",
  create: () => ({
    type: "container",
    children: [heroBlock.create()],
  }),
});

export const builder = createPagebldr({
  namespace: "custom-elements-example",
  elements: [...standardElements, cardElement],
  styleCapabilities: [...standardStyleCapabilities, emphasisStyle],
  blocks: [heroBlock],
  templates: [landingTemplate],
  resources: {
    asset: {
      reference: {
        "~standard": {
          version: 1,
          vendor: "custom-elements-example",
          validate: (value) =>
            typeof value === "string"
              ? { value }
              : { issues: [{ message: "Asset ID must be a string." }] },
        },
      },
      resolve: (id) => (typeof id === "string" ? `/assets/${id}` : null),
    },
  },
});
