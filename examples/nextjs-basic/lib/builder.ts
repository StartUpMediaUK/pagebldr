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

export const publishedDocument = builder.documents.create({
  id: "welcome",
  title: "Published with pagebldr",
  slug: "welcome",
});

export const eventSink = memoryEventSink();
export const events = createEventDelivery({ sink: eventSink });
