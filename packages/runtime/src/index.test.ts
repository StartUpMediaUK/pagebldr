import { createPagebldr, type PageDocument } from "@pagebldr/core";
import { describe, expect, it } from "vitest";

import { createPagebldrRuntime } from "./index.js";

const document: PageDocument = {
  format: "pagebldr",
  schemaVersion: 1,
  id: "home",
  title: "Home",
};

describe("createPagebldrRuntime", () => {
  it("resolves a published document and prepares route metadata", async () => {
    const runtime = createPagebldrRuntime({
      builder: createPagebldr({ namespace: "test-app" }),
      publications: { resolve: () => Promise.resolve(document) },
    });

    await expect(runtime.resolve({ path: "/" })).resolves.toMatchObject({
      status: "found",
      page: { canonicalPath: "/", metadata: { title: "Home" } },
    });
  });

  it("returns notFound when the Host has no matching publication", async () => {
    const runtime = createPagebldrRuntime({
      builder: createPagebldr({ namespace: "test-app" }),
      publications: { resolve: () => Promise.resolve(null) },
    });

    await expect(runtime.resolve({ path: "/missing" })).resolves.toEqual({
      status: "notFound",
    });
  });
});
