export { createPagebldr } from "./config.js";
export {
  DOCUMENT_FORMAT,
  DOCUMENT_SCHEMA_VERSION,
  MAX_DOCUMENT_DEPTH,
  MAX_DOCUMENT_ELEMENTS,
} from "./document-constants.js";
export { defineElement } from "./element.js";
export { assertUniqueId, createId, createSequentialIdFactory } from "./ids.js";
export { PagebldrError } from "./types.js";
export type { Pagebldr, PagebldrOptions } from "./config.js";
export type { CreateDocumentInput } from "./document.js";
export type {
  Breakpoint,
  DocumentIndex,
  PageDocument,
  PageElement,
  PageSettings,
  ResponsiveStyles,
  StateStyles,
  StyleClass,
  StyleDeclarations,
  StyleState,
  StyleValue,
  StyleVariable,
  VariableKind,
  VariableReference,
} from "./document-types.js";
export type { Documents } from "./documents.js";
export type { ElementControl, ElementDefinition } from "./element.js";
export type { IdFactory } from "./ids.js";
export type { DocumentMigration } from "./migrations.js";
export type {
  InferSchemaOutput,
  StandardSchemaResult,
  StandardSchemaV1,
} from "./schema.js";
export type {
  PagebldrErrorCode,
  PreparedResources,
  ResourceAdapter,
  ResourceContext,
  ResourceReference,
} from "./types.js";
export type { ValidationResult } from "./validation.js";
