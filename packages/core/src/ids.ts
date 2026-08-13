import { PagebldrError } from "./types.js";

export type IdFactory = (prefix: string) => string;

export const createId: IdFactory = (prefix) => {
  const normalized = prefix.replace(/[^A-Za-z0-9_-]/gu, "-");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `${normalized}-${random}`;
};

export function createSequentialIdFactory(namespace = "generated"): IdFactory {
  let sequence = 0;
  return (prefix) => `${namespace}-${prefix}-${++sequence}`;
}

export function assertUniqueId(
  id: string,
  records: Readonly<Record<string, unknown>>,
): void {
  if (Object.hasOwn(records, id)) {
    throw new PagebldrError("DUPLICATE_ID", `ID ${id} already exists.`, {
      details: { id },
    });
  }
}
