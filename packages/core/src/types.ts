import type { StandardSchemaV1 } from "./schema.js";

export interface ResourceReference<
  Kind extends string = string,
  Value = unknown,
> {
  readonly kind: Kind;
  readonly value: Value;
}

export interface ResourceAdapter<Reference = unknown, Item = unknown> {
  readonly reference: StandardSchemaV1<unknown, Reference>;
  readonly resolve: (
    reference: Reference,
    context: ResourceContext,
  ) => string | null | Promise<string | null>;
  readonly browse?: (
    request: { readonly query?: string; readonly cursor?: string },
    context: ResourceContext,
  ) => Promise<{
    readonly items: readonly Item[];
    readonly nextCursor?: string;
  }>;
}

export interface ResourceContext {
  readonly scope?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface PreparedResources {
  readonly values: ReadonlyMap<string, string | null>;
}

export interface PagebldrErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class PagebldrError extends Error {
  readonly code: PagebldrErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: PagebldrErrorCode,
    message: string,
    options: PagebldrErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "PagebldrError";
    this.code = code;
    this.details = options.details;
  }
}

export type PagebldrErrorCode =
  | "BROKEN_REFERENCE"
  | "CAPABILITY_UNAVAILABLE"
  | "CONFLICT"
  | "CIRCULAR_NESTING"
  | "DUPLICATE_ID"
  | "DUPLICATE_REGISTRATION"
  | "ELEMENT_NOT_FOUND"
  | "FUTURE_SCHEMA"
  | "INVALID_CONFIGURATION"
  | "INVALID_COMMAND"
  | "INVALID_DOCUMENT"
  | "INVALID_ELEMENT"
  | "INVALID_NAMESPACE"
  | "INVALID_PARENT"
  | "LOCKED_ELEMENT"
  | "MIGRATION_MISSING"
  | "NOT_FOUND"
  | "ROOT_OPERATION"
  | "STRUCTURAL_LIMIT";
