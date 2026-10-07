import {
  remapClipboard,
  serializeSubtree,
  type PagebldrClipboard,
} from "./clipboard.js";
import type { PageDocument } from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import { createId, type IdFactory } from "./ids.js";
import type { StyleEngine } from "./styles.js";
import { PagebldrError } from "./types.js";
import { assertValidDocument } from "./validation.js";

export interface LibraryPreparation {
  /** Prepare an independent Block, reusing the destination's shared design. */
  readonly prepareBlock: (
    clipboard: PagebldrClipboard,
    destination: PageDocument,
    idFactory?: IdFactory,
  ) => PagebldrClipboard;
  /** Clone a current-schema Template before command-only application. */
  readonly cloneTemplate: (
    template: PageDocument,
    idFactory?: IdFactory,
  ) => PageDocument;
}

export function createLibraryPreparation(
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): LibraryPreparation {
  return Object.freeze({
    prepareBlock: (
      input: PagebldrClipboard,
      destination: PageDocument,
      idFactory: IdFactory = createId,
    ) => {
      if (input.format !== "pagebldr-clipboard" || input.schemaVersion !== 1)
        throw new PagebldrError(
          "INVALID_DOCUMENT",
          "Library clipboard format is invalid.",
        );
      const clipboard = remapClipboard(
        input,
        freshIds(idFactory, [
          ...Object.keys(input.elements),
          ...Object.keys(destination.elements),
        ]),
      );
      // Stable dependency IDs intentionally share the page's customized design.
      // Command dispatch remains the structural and semantic validation boundary.
      return {
        ...clipboard,
        classes: reuseDependencies(clipboard.classes, destination.classes),
        variables: reuseDependencies(
          clipboard.variables,
          destination.variables,
        ),
      };
    },
    cloneTemplate: (source: PageDocument, idFactory: IdFactory = createId) => {
      assertValidDocument(source, definitions, styles);
      const nextId = freshIds(idFactory, [
        source.id,
        ...Object.keys(source.elements),
      ]);
      const id = nextId("page");
      const clipboard = remapClipboard(
        serializeSubtree(source, source.rootId),
        nextId,
      );
      // Templates include all design dependencies, including unused definitions.
      const document: PageDocument = {
        ...structuredClone(source),
        id,
        rootId: clipboard.rootId,
        elements: clipboard.elements,
      };
      return assertValidDocument(document, definitions, styles).document;
    },
  });
}

function reuseDependencies<Value>(
  incoming: Readonly<Record<string, Value>>,
  existing: Readonly<Record<string, Value>>,
): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(incoming).map(([id, value]) => [
      id,
      structuredClone(existing[id] ?? value),
    ]),
  );
}

function freshIds(factory: IdFactory, reserved: readonly string[]): IdFactory {
  const used = new Set(reserved);
  return (prefix) => {
    const id = factory(prefix);
    if (used.has(id))
      throw new PagebldrError(
        "DUPLICATE_ID",
        `Library ID factory reused ${id}.`,
      );
    used.add(id);
    return id;
  };
}
