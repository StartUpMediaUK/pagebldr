import { buildDocumentIndex, parseDocument } from "./document.js";
import type {
  DocumentIndex,
  PageDocument,
  StyleValue,
} from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import { PagebldrError } from "./types.js";

export type ValidationResult =
  | {
      readonly valid: true;
      readonly document: PageDocument;
      readonly index: DocumentIndex;
    }
  | { readonly valid: false; readonly error: PagebldrError };

export function assertValidDocument(
  input: unknown,
  definitions: ReadonlyMap<string, ElementDefinition>,
): { readonly document: PageDocument; readonly index: DocumentIndex } {
  const document = parseDocument(input);
  const index = buildDocumentIndex(document);
  assertUniqueNames("Class", document.classes);
  assertUniqueNames("Variable", document.variables);

  for (const element of Object.values(document.elements)) {
    const definition = definitions.get(element.type);
    if (!definition) {
      throw new PagebldrError(
        "INVALID_ELEMENT",
        `No Element definition is registered for ${element.type}.`,
        { details: { elementId: element.id, type: element.type } },
      );
    }
    if (element.elementVersion !== definition.version) {
      throw new PagebldrError(
        element.elementVersion > definition.version
          ? "FUTURE_SCHEMA"
          : "MIGRATION_MISSING",
        `Element ${element.id} is not at registered version ${definition.version}.`,
      );
    }
    const result = definition.props["~standard"].validate(element.props);
    if (result instanceof Promise) {
      throw new PagebldrError(
        "INVALID_CONFIGURATION",
        `Element ${element.type} uses an asynchronous schema; Document validation is synchronous.`,
      );
    }
    if (
      result &&
      typeof result === "object" &&
      "issues" in result &&
      result.issues
    ) {
      throw new PagebldrError(
        "INVALID_ELEMENT",
        `Element ${element.id} props are invalid.`,
        { details: { elementId: element.id, issues: result.issues } },
      );
    }
    const policy = definition.childPolicy ?? { kind: "any" };
    if (policy.kind === "none" && element.children.length > 0) {
      throw new PagebldrError(
        "INVALID_ELEMENT",
        `Element ${element.id} cannot contain children.`,
      );
    }
    if (
      "max" in policy &&
      policy.max !== undefined &&
      element.children.length > policy.max
    ) {
      throw new PagebldrError(
        "STRUCTURAL_LIMIT",
        `Element ${element.id} exceeds its child limit.`,
      );
    }
    if (policy.kind === "types") {
      for (const childId of element.children) {
        const child = document.elements[childId]!;
        if (!policy.types.includes(child.type))
          throw new PagebldrError(
            "INVALID_ELEMENT",
            `Element ${element.id} cannot contain ${child.type}.`,
          );
      }
    }
    for (const classId of element.classIds) {
      if (!document.classes[classId]) {
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Element ${element.id} references missing Class ${classId}.`,
        );
      }
    }
    walkStyles(element.styles, (value) =>
      assertVariableReference(document, value),
    );
  }
  for (const styleClass of Object.values(document.classes)) {
    walkStyles(styleClass.styles, (value) =>
      assertVariableReference(document, value),
    );
  }
  return { document, index };
}

export function validateDocument(
  input: unknown,
  definitions: ReadonlyMap<string, ElementDefinition>,
): ValidationResult {
  try {
    const result = assertValidDocument(input, definitions);
    return { valid: true, ...result };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof PagebldrError
          ? error
          : new PagebldrError(
              "INVALID_DOCUMENT",
              "Document validation failed.",
              {
                cause: error,
              },
            ),
    };
  }
}

function assertUniqueNames(
  label: string,
  records: Readonly<Record<string, { readonly name: string }>>,
): void {
  const names = new Set<string>();
  for (const record of Object.values(records)) {
    const normalized = record.name.trim().toLocaleLowerCase();
    if (names.has(normalized)) {
      throw new PagebldrError(
        "INVALID_DOCUMENT",
        `${label} names must be unique. Duplicate: ${record.name}.`,
      );
    }
    names.add(normalized);
  }
}

function walkStyles(
  styles: PageDocument["elements"][string]["styles"],
  visit: (value: StyleValue) => void,
): void {
  for (const states of Object.values(styles)) {
    if (!states) continue;
    for (const declarations of Object.values(states)) {
      if (!declarations) continue;
      for (const value of Object.values(declarations)) visit(value);
    }
  }
}

function assertVariableReference(
  document: PageDocument,
  value: StyleValue,
): void {
  if (typeof value !== "object") return;
  if (!document.variables[value.variableId]) {
    throw new PagebldrError(
      "BROKEN_REFERENCE",
      `Style references missing Variable ${value.variableId}.`,
    );
  }
}
