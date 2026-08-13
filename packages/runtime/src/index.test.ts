import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import { describe, expect, it } from "vitest";

import { createPagebldrRuntime } from "./index.js";

const builder = createPagebldr({
  namespace: "test-app",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const document = builder.documents.create({ id: "home", title: "Home" });

describe("createPagebldrRuntime", () => {
  it("resolves a published document and prepares route metadata", async () => {
    const runtime = createPagebldrRuntime({
      builder,
      publications: { resolve: () => Promise.resolve(document) },
    });

    await expect(runtime.resolve({ path: "/" })).resolves.toMatchObject({
      status: "found",
      page: { canonicalPath: "/", metadata: { title: "Home" } },
    });
  });

  it("returns notFound when the Host has no matching publication", async () => {
    const runtime = createPagebldrRuntime({
      builder,
      publications: { resolve: () => Promise.resolve(null) },
    });

    await expect(runtime.resolve({ path: "/missing" })).resolves.toEqual({
      status: "notFound",
    });
  });

  it("normalizes paths and returns redirects and isolated errors", async () => {
    const seen: string[] = [];
    const runtime = createPagebldrRuntime({
      builder,
      canonicalOrigin: "https://example.com/base",
      publications: {
        resolve: ({ path }) => {
          seen.push(path);
          return Promise.resolve(
            path === "/old" ? { redirect: "/new/" } : document,
          );
        },
      },
    });
    await expect(
      runtime.resolve({ path: "https://host.test/old/?query=1" }),
    ).resolves.toEqual({
      status: "redirect",
      location: "/new",
      permanent: false,
    });
    const found = await runtime.resolve({ path: "/hello%20world/" });
    expect(seen).toEqual(["/old", "/hello%20world"]);
    expect(found).toMatchObject({
      status: "found",
      page: {
        canonicalPath: "/hello%20world",
        canonicalUrl: "https://example.com/hello%20world",
      },
    });

    const broken = createPagebldrRuntime({
      builder,
      publications: {
        resolve: () => Promise.reject(new Error("database offline")),
      },
    });
    await expect(broken.resolve({ path: "/" })).resolves.toMatchObject({
      status: "error",
      error: { message: "database offline" },
    });
  });
});
