import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "pagebldr";
import { createEventDelivery, memoryEventSink } from "pagebldr/runtime";

export const builder = createPagebldr({
  namespace: "nextjs-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

const emptyDocument = builder.documents.create({
  id: "welcome",
  title: "Published with pagebldr",
  slug: "welcome",
});

// This private Host supplies initial content through the public command interface.
const definitions = [
  {
    id: "welcome-heading",
    type: "heading",
    props: { content: "Published with pagebldr", level: 1 },
  },
  {
    id: "welcome-tabs",
    type: "tabs",
    props: {
      items: [
        {
          id: "discover",
          label: "Discover",
          content: "Understand the current situation.",
        },
        {
          id: "decide",
          label: "Decide",
          content: "See the clearest next step.",
        },
        { id: "act", label: "Act", content: "Move forward with confidence." },
      ],
    },
  },
];
export const publishedDocument = builder.editor.dispatchMany(
  emptyDocument,
  definitions.map((item, index) => {
    const definition = builder.elements.get(item.type)!;
    return {
      type: "insert" as const,
      parentId: emptyDocument.rootId,
      index,
      clipboard: {
        format: "pagebldr-clipboard" as const,
        schemaVersion: 1 as const,
        rootId: item.id,
        classes: {},
        classOrder: [],
        variables: {},
        variableOrder: [],
        elements: {
          [item.id]: {
            id: item.id,
            type: item.type,
            elementVersion: definition.version,
            name: definition.label,
            props: item.props,
            children: [],
            classIds: [],
            styles: {},
            locked: false,
            hidden: false,
          },
        },
      },
    };
  }),
).document;

export const eventSink = memoryEventSink();
export const events = createEventDelivery({ sink: eventSink });
