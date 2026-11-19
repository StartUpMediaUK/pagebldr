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
        Object.values(destination.elements).flatMap((element) =>
          typeof element.props.anchorId === "string"
            ? [element.props.anchorId]
            : [],
        ),
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

function reuseDependencies<Value extends { readonly name: string }>(
  incoming: Readonly<Record<string, Value>>,
  existing: Readonly<Record<string, Value>>,
): Record<string, Value> {
  const normalize = (name: string) => name.trim().toLocaleLowerCase();
  const used = new Set(
    Object.values(existing).map((value) => normalize(value.name)),
  );
  const result: Record<string, Value> = {};
  for (const [id, value] of Object.entries(incoming)) {
    if (existing[id]) {
      result[id] = structuredClone(existing[id]);
      continue;
    }
    let name = value.name;
    let suffix = 2;
    while (used.has(normalize(name)))
      name = `${value.name.slice(0, 108)} (${suffix++})`;
    used.add(normalize(name));
    result[id] = { ...structuredClone(value), name };
  }
  return result;
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
