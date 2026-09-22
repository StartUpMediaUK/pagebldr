import {
  buildDocumentIndex,
  cloneDocument,
  createDocument,
  deserializeDocument,
  parseDocument,
  serializeDocument,
  type CreateDocumentInput,
} from "./document.js";
import type { DocumentIndex, PageDocument } from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import type { StyleEngine } from "./styles.js";
import {
  migrateDocumentSchema,
  migrateElementVersions,
  type DocumentMigration,
  standardDocumentMigrations,
  validateMigrationChain,
} from "./migrations.js";
import {
  assertValidDocument,
  validateDocument,
  type ValidationResult,
} from "./validation.js";

export interface Documents {
  readonly create: (input: CreateDocumentInput) => PageDocument;
  readonly parse: (input: unknown) => PageDocument;
  readonly migrate: (input: unknown) => PageDocument;
  readonly validate: (input: unknown) => ValidationResult;
  readonly clone: (document: PageDocument) => PageDocument;
  readonly serialize: (document: PageDocument) => string;
  readonly deserialize: (serialized: string) => PageDocument;
  readonly index: (document: PageDocument) => DocumentIndex;
}

export function createDocuments(
  definitions: ReadonlyMap<string, ElementDefinition>,
  documentMigrations: readonly DocumentMigration[],
  styles: StyleEngine,
): Documents {
  const migrations = validateMigrationChain([
    ...documentMigrations,
    ...standardDocumentMigrations,
  ]);
  return Object.freeze({
    create: (input: CreateDocumentInput) => {
      const rootType = input.rootType ?? "container";
      const definition = definitions.get(rootType);
      const rootProps =
        input.rootProps ??
        (definition?.defaults() as
          Readonly<Record<string, unknown>> | undefined);
      const document = createDocument({
        ...input,
        rootType,
        ...(rootProps ? { rootProps } : {}),
      });
      if (!definition) return document;
      return {
        ...document,
        elements: {
          ...document.elements,
          [document.rootId]: {
            ...document.elements[document.rootId]!,
            elementVersion: definition.version,
          },
        },
      };
    },
    parse: parseDocument,
    migrate: (input: unknown) => {
      const schemaMigrated = migrateDocumentSchema(input, migrations);
      const elementMigrated = migrateElementVersions(
        schemaMigrated,
        definitions,
      );
      return assertValidDocument(elementMigrated, definitions, styles).document;
    },
    validate: (input: unknown) => validateDocument(input, definitions, styles),
    clone: cloneDocument,
    serialize: (document: PageDocument) => {
      assertValidDocument(document, definitions, styles);
      return serializeDocument(document);
    },
    deserialize: (serialized: string) => {
      const document = deserializeDocument(serialized);
      return assertValidDocument(document, definitions, styles).document;
    },
    index: buildDocumentIndex,
  });
}
