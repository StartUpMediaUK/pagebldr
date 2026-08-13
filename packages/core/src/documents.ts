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
import {
  migrateDocumentSchema,
  migrateElementVersions,
  type DocumentMigration,
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
): Documents {
  const migrations = validateMigrationChain(documentMigrations);
  return Object.freeze({
    create: createDocument,
    parse: parseDocument,
    migrate: (input: unknown) => {
      const schemaMigrated = migrateDocumentSchema(input, migrations);
      const elementMigrated = migrateElementVersions(
        schemaMigrated,
        definitions,
      );
      return assertValidDocument(elementMigrated, definitions).document;
    },
    validate: (input: unknown) => validateDocument(input, definitions),
    clone: cloneDocument,
    serialize: (document: PageDocument) => {
      assertValidDocument(document, definitions);
      return serializeDocument(document);
    },
    deserialize: (serialized: string) => {
      const document = deserializeDocument(serialized);
      return assertValidDocument(document, definitions).document;
    },
    index: buildDocumentIndex,
  });
}
