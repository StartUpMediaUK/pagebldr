import {
  DOCUMENT_FORMAT,
  DOCUMENT_SCHEMA_VERSION,
} from "./document-constants.js";
import { cloneDocument, parseDocument } from "./document.js";
import type { PageDocument, PageElement } from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import { PagebldrError } from "./types.js";

export interface DocumentMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (
    input: Readonly<Record<string, unknown>>,
  ) => Record<string, unknown>;
}

export const standardDocumentMigrations: readonly DocumentMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (input) => {
      const settings = input.settings as
        | {
            readonly contentWidth?: unknown;
            readonly breakpoints?: unknown;
            readonly metadata?: {
              readonly title?: unknown;
              readonly description?: unknown;
              readonly noIndex?: unknown;
            };
          }
        | undefined;
      const metadata = settings?.metadata;
      return {
        ...input,
        settings: {
          contentWidth: settings?.contentWidth,
          showDefaultHeader: true,
          breakpoints: settings?.breakpoints,
          seo: {
            title: metadata?.title ?? "",
            description: metadata?.description ?? "",
            socialTitle: "",
            socialDescription: "",
            socialImage: null,
            noIndex: metadata?.noIndex ?? false,
          },
        },
      };
    },
  },
];

export function validateMigrationChain(
  migrations: readonly DocumentMigration[],
): ReadonlyMap<number, DocumentMigration> {
  const byVersion = new Map<number, DocumentMigration>();
  for (const migration of migrations) {
    if (migration.toVersion !== migration.fromVersion + 1) {
      throw new PagebldrError(
        "MIGRATION_MISSING",
        "Document migrations must advance exactly one schema version.",
      );
    }
    if (byVersion.has(migration.fromVersion)) {
      throw new PagebldrError(
        "MIGRATION_MISSING",
        `A migration from schema ${migration.fromVersion} is registered more than once.`,
      );
    }
    byVersion.set(migration.fromVersion, migration);
  }
  return byVersion;
}

export function migrateDocumentSchema(
  input: unknown,
  migrations: ReadonlyMap<number, DocumentMigration>,
): PageDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      "Document data is not an object.",
    );
  }
  let current = structuredClone(input) as Record<string, unknown>;
  if (current.format !== DOCUMENT_FORMAT) {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      `Document format must be ${DOCUMENT_FORMAT}.`,
    );
  }
  if (!Number.isInteger(current.schemaVersion)) {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      "Document data has no valid schema version.",
    );
  }
  let version = current.schemaVersion as number;
  if (version > DOCUMENT_SCHEMA_VERSION) {
    throw new PagebldrError(
      "FUTURE_SCHEMA",
      `Document schema ${version} is newer than supported schema ${DOCUMENT_SCHEMA_VERSION}.`,
    );
  }
  while (version < DOCUMENT_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration) {
      throw new PagebldrError(
        "MIGRATION_MISSING",
        `No Document migration exists from schema ${version}.`,
      );
    }
    current = migration.migrate(structuredClone(current));
    current = { ...current };
    version = migration.toVersion;
    current.schemaVersion = version;
  }
  return parseDocument(current);
}

export function migrateElementVersions(
  input: PageDocument,
  definitions: ReadonlyMap<string, ElementDefinition>,
): PageDocument {
  const document = cloneDocument(parseDocument(input));
  const elements = document.elements as Record<string, PageElement>;
  for (const element of Object.values(elements)) {
    const definition = definitions.get(element.type);
    if (!definition) {
      throw new PagebldrError(
        "INVALID_ELEMENT",
        `No Element definition is registered for ${element.type}.`,
        { details: { elementId: element.id, type: element.type } },
      );
    }
    if (element.elementVersion > definition.version) {
      throw new PagebldrError(
        "FUTURE_SCHEMA",
        `Element ${element.id} is newer than its ${element.type} definition.`,
      );
    }
    let current = element;
    while (current.elementVersion < definition.version) {
      if (!definition.migrate) {
        throw new PagebldrError(
          "MIGRATION_MISSING",
          `No ${element.type} migration exists from Element version ${current.elementVersion}.`,
        );
      }
      const props = definition.migrate(
        structuredClone(current.props),
        current.elementVersion,
      );
      if (!props || typeof props !== "object" || Array.isArray(props)) {
        throw new PagebldrError(
          "INVALID_ELEMENT",
          `Element ${element.id} migration did not return a props object.`,
        );
      }
      current = {
        ...current,
        props: Object.fromEntries(Object.entries(props)),
        elementVersion: current.elementVersion + 1,
      };
      elements[element.id] = current;
    }
  }
  return document;
}
