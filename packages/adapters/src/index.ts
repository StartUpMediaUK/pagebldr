import type { StorageAdapter } from "@pagebldr/server";

export function memoryAdapter(): StorageAdapter<"memory", "memory"> {
  return Object.freeze({
    integration: "memory",
    provider: "memory",
    capabilities: {
      atomicSave: true,
      optimisticConcurrency: true,
      transactionalAudit: true,
    },
  });
}
