import { createPagebldr } from "@pagebldr/core";
import { describe, expect, it } from "vitest";

import { createPagebldrServer, type StorageAdapter } from "./index.js";

const capabilities = {
  atomicLifecycle: true,
  optimisticConcurrency: true,
  revisions: true,
  publicationPointers: true,
  pagination: true,
  scopeIsolation: true,
  transactionalAudit: false,
};

function storage(
  overrides: Partial<typeof capabilities> = {},
): StorageAdapter<"prisma", "mongodb"> {
  return {
    integration: "prisma",
    provider: "mongodb",
    capabilities: { ...capabilities, ...overrides },
    setup: { strategy: "prisma-db-push", summary: "Test" },
    read: () => Promise.reject(new Error("not called")),
    transaction: () => Promise.reject(new Error("not called")),
  };
}

describe("createPagebldrServer", () => {
  it("preserves provider identity", () => {
    const server = createPagebldrServer({
      builder: createPagebldr({ namespace: "test-app" }),
      storage: storage(),
      collection: { mode: "multiple" },
    });
    expect(server.storage.provider).toBe("mongodb");
  });

  it("refuses missing required capabilities", () => {
    expect(() =>
      createPagebldrServer({
        builder: createPagebldr({ namespace: "test-app" }),
        storage: storage({ transactionalAudit: false }),
        collection: { mode: "single", key: "home" },
        requireCapabilities: { transactionalAudit: true },
      }),
    ).toThrowError("transactionalAudit");
  });
});
