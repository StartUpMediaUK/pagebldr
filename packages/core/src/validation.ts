import { buildDocumentIndex, parseDocument } from "./document.js";
import { parseDestination } from "./destinations.js";
import type {
  DocumentIndex,
  PageDocument,
  StyleValue,
} from "./document-types.js";
import { styleVariableKindsForProperty } from "./styles.js";
import type { ElementDefinition } from "./element.js";
import type { StyleEngine } from "./styles.js";
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
  styles: StyleEngine,
): { readonly document: PageDocument; readonly index: DocumentIndex } {
  const document = parseDocument(input);
  const index = buildDocumentIndex(document);
  if (document.elements[document.rootId]?.type !== "container") {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      "The Document root must be a container Element.",
    );
  }
  assertUniqueNames("Class", document.classes);
  assertUniqueNames("Variable", document.variables);
  assertUniqueAnchors(document);

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
    walkStyles(element.styles, (value, property) => {
      assertSupportedStyleProperty(definition, styles, property, element.id);
      assertVariableReference(document, value, property);
    });
    for (const value of definition.destinations?.(element.props) ?? []) {
      const destination = parseDestination(value);
      if (
        destination.type === "anchor" &&
        !document.elements[destination.elementId]
      ) {
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Anchor destination references missing Element ${destination.elementId}.`,
        );
      }
    }
  }
  for (const styleClass of Object.values(document.classes)) {
    walkStyles(styleClass.styles, (value, property) => {
      if (!styles.properties.has(property))
        throw new PagebldrError(
          "INVALID_ELEMENT",
          `Class ${styleClass.id} uses unregistered style property ${property}.`,
        );
      assertVariableReference(document, value, property);
    });
  }
  for (const element of Object.values(document.elements)) {
    const definition = definitions.get(element.type)!;
    for (const classId of element.classIds) {
      const styleClass = document.classes[classId]!;
      walkStyles(styleClass.styles, (_value, property) =>
        assertSupportedStyleProperty(definition, styles, property, element.id),
      );
    }
  }
  return { document, index };
}

function assertUniqueAnchors(document: PageDocument): void {
  const anchors = new Set<string>();
  for (const element of Object.values(document.elements)) {
    const anchorId = element.props.anchorId;
    if (anchorId === undefined || anchorId === null) continue;
    if (
      typeof anchorId !== "string" ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(anchorId) ||
      anchorId.length > 80
    ) {
      throw new PagebldrError(
        "INVALID_DOCUMENT",
        `Element ${element.id} has an invalid anchor ID.`,
      );
    }
    if (anchors.has(anchorId)) {
      throw new PagebldrError(
        "INVALID_DOCUMENT",
        `Anchor IDs must be unique. Duplicate: ${anchorId}.`,
      );
    }
    anchors.add(anchorId);
  }
}

export function validateDocument(
  input: unknown,
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): ValidationResult {
  try {
    const result = assertValidDocument(input, definitions, styles);
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
  visit: (value: StyleValue, property: string) => void,
): void {
  for (const states of Object.values(styles)) {
    if (!states) continue;
    for (const declarations of Object.values(states)) {
      if (!declarations) continue;
      for (const [property, value] of Object.entries(declarations))
        visit(value, property);
    }
  }
}

function assertVariableReference(
  document: PageDocument,
  value: StyleValue,
  property: string,
): void {
  if (typeof value !== "object") return;
  if (!document.variables[value.variableId]) {
    throw new PagebldrError(
      "BROKEN_REFERENCE",
      `Style references missing Variable ${value.variableId}.`,
    );
  }
  const variable = document.variables[value.variableId]!;
  if (!styleVariableKindsForProperty(property).includes(variable.kind)) {
    throw new PagebldrError(
      "INVALID_ELEMENT",
      `${variable.kind} Variable ${variable.id} cannot be used for ${property}.`,
    );
  }
}

function assertSupportedStyleProperty(
  definition: ElementDefinition,
  styles: StyleEngine,
  property: string,
  elementId: string,
): void {
  const supported = (definition.styles ?? []).some((key) =>
    styles.capabilities.get(key)?.properties.includes(property),
  );
  if (!supported) {
    throw new PagebldrError(
      "INVALID_ELEMENT",
      `Element ${elementId} does not support style property ${property}.`,
    );
  }
}
