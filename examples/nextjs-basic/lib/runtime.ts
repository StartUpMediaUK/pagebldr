import { createPagebldrRuntime } from "pagebldr/runtime";

import { builder, events, publishedDocument } from "./builder";

export const runtime = createPagebldrRuntime({
  builder,
  events,
  canonicalOrigin: "https://example.test",
  publications: {
    resolve: ({ path }) =>
      Promise.resolve(path === "/welcome" ? publishedDocument : null),
  },
});
