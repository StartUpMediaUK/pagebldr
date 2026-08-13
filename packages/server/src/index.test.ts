import { createPagebldr } from "@pagebldr/core";
import { describe, expect, it } from "vitest";

import { createPagebldrServer, type StorageAdapter } from "./index.js";

describe("createPagebldrServer", () => {
  it("preserves provider identity", () => {
    const storage: StorageAdapter<"prisma", "mongodb"> = {
      integration: "prisma",
      provider: "mongodb",
      capabilities: {
        atomicSave: true,
        optimisticConcurrency: true,
        transactionalAudit: false,
      },
    };
    const server = createPagebldrServer({
      builder: createPagebldr({ namespace: "test-app" }),
      storage,
      collection: { mode: "multiple" },
    });

    expect(server.storage.provider).toBe("mongodb");
  });

  it("refuses missing required capabilities", () => {
    expect(() =>
      createPagebldrServer({
        builder: createPagebldr({ namespace: "test-app" }),
        storage: {
          integration: "prisma",
          provider: "mongodb",
          capabilities: {
            atomicSave: true,
            optimisticConcurrency: true,
            transactionalAudit: false,
          },
        },
        collection: { mode: "single", key: "home" },
        requireCapabilities: { transactionalAudit: true },
      }),
    ).toThrowError("transactionalAudit");
  });
});
