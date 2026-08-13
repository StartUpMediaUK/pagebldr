import { createDocument } from "./document.js";
import type { PageDocument, PageElement } from "./document-types.js";

export function createShallowFixture(): PageDocument {
  const document = createDocument({ id: "fixture-page", title: "Fixture" });
  return deepFreeze(document);
}

export function createDeepFixture(size = 50): PageDocument {
  return createLinearFixture(size);
}

export function createFiveHundredElementFixture(): PageDocument {
  return createLinearFixture(500);
}

export function createInvalidFixture(): unknown {
  return deepFreeze({
    ...createDocument({ id: "invalid-page" }),
    rootId: "missing-root",
  });
}

function createLinearFixture(size: number): PageDocument {
  if (!Number.isInteger(size) || size < 1 || size > 500) {
    throw new RangeError("Fixture size must be between 1 and 500.");
  }
  const document = createDocument({ id: `fixture-${size}` });
  const elements: Record<string, PageElement> = {};
  for (let index = 0; index < size; index += 1) {
    const id = index === 0 ? "root" : `element-${index}`;
    const childId = index + 1 < size ? `element-${index + 1}` : undefined;
    elements[id] = {
      id,
      type: "container",
      elementVersion: 1,
      name: `Element ${index}`,
      props: {},
      children: childId ? [childId] : [],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
  }
  return deepFreeze({ ...document, elements });
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
