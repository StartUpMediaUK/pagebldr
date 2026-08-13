import type {
  Breakpoint,
  PageDocument,
  ResponsiveStyles,
  StyleDeclarations,
  StyleState,
  StyleValue,
} from "./document-types.js";
import { PagebldrError } from "./types.js";

export interface StyleCapabilityDefinition {
  readonly key: string;
  readonly label: string;
  readonly properties: readonly string[];
}

export interface CompiledDocumentStyles {
  readonly css: string;
  readonly scopeAttribute: "data-pagebldr";
  readonly scopeValue: string;
  readonly documentAttribute: "data-pagebldr-document";
  readonly documentValue: string;
}

export interface StyleEngine {
  readonly capabilities: ReadonlyMap<string, StyleCapabilityDefinition>;
  readonly properties: ReadonlySet<string>;
  readonly compile: (document: PageDocument) => CompiledDocumentStyles;
}

const keyPattern = /^[a-z][a-z0-9-]*$/u;
const propertyPattern = /^(?:--[a-z][a-z0-9-]*|[a-z][a-z0-9-]*)$/u;
const unsafeValuePattern = /[;{}]/u;
const breakpoints: readonly Breakpoint[] = ["desktop", "tablet", "mobile"];
const states: readonly StyleState[] = ["normal", "hover", "focusVisible"];

export function defineStyleCapability(
  definition: StyleCapabilityDefinition,
): StyleCapabilityDefinition {
  if (!keyPattern.test(definition.key) || definition.label.trim() === "")
    invalid(
      "Style capability keys must use lowercase kebab-case and have a label.",
    );
  if (definition.properties.length === 0)
    invalid(`Style capability ${definition.key} must declare properties.`);
  const seen = new Set<string>();
  for (const property of definition.properties) {
    if (!propertyPattern.test(property) || seen.has(property))
      invalid(
        `Style capability ${definition.key} has an invalid or duplicate property ${property}.`,
      );
    seen.add(property);
  }
  return Object.freeze({
    ...definition,
    properties: Object.freeze([...definition.properties]),
  });
}

export function createStyleEngine(
  namespace: string,
  definitions: readonly StyleCapabilityDefinition[],
): StyleEngine {
  const capabilities = new Map<string, StyleCapabilityDefinition>();
  const properties = new Set<string>();
  for (const input of definitions) {
    const definition = defineStyleCapability(input);
    if (capabilities.has(definition.key))
      duplicate("capability", definition.key);
    for (const property of definition.properties) {
      if (properties.has(property)) duplicate("style property", property);
      properties.add(property);
    }
    capabilities.set(definition.key, definition);
  }
  return Object.freeze({
    capabilities,
    properties,
    compile: (document: PageDocument) =>
      compileDocumentStyles(namespace, document, properties),
  });
}

export function compileDocumentStyles(
  namespace: string,
  document: PageDocument,
  allowedProperties: ReadonlySet<string>,
): CompiledDocumentStyles {
  const root = `[data-pagebldr="${escapeAttribute(namespace)}"][data-pagebldr-document="${escapeAttribute(document.id)}"]`;
  const sections: string[] = [];
  const variables = document.variableOrder.map((id) => {
    const variable = document.variables[id]!;
    return `--pb-${namespace}-v-${escapeIdentifier(id)}:${serializePrimitive(variable.value)}`;
  });
  if (variables.length > 0) sections.push(`${root}{${variables.join(";")}}`);

  for (const id of document.classOrder) {
    const styleClass = document.classes[id]!;
    appendResponsiveRules(
      sections,
      `${root} [data-pagebldr-class~="${escapeAttribute(id)}"]`,
      styleClass.styles,
      document,
      namespace,
      allowedProperties,
    );
  }
  for (const id of preorder(document)) {
    const element = document.elements[id]!;
    const selector = `${root} [data-pagebldr-element="${escapeAttribute(id)}"]`;
    if (element.hidden) sections.push(`${selector}{display:none!important}`);
    appendResponsiveRules(
      sections,
      selector,
      element.styles,
      document,
      namespace,
      allowedProperties,
    );
  }
  return Object.freeze({
    css: sections.join("\n"),
    scopeAttribute: "data-pagebldr",
    scopeValue: namespace,
    documentAttribute: "data-pagebldr-document",
    documentValue: document.id,
  });
}

function appendResponsiveRules(
  output: string[],
  selector: string,
  styles: ResponsiveStyles,
  document: PageDocument,
  namespace: string,
  allowed: ReadonlySet<string>,
): void {
  for (const breakpoint of breakpoints) {
    const stateStyles = styles[breakpoint];
    if (!stateStyles) continue;
    const rules: string[] = [];
    for (const state of states) {
      const declarations = stateStyles[state];
      if (!declarations) continue;
      const body = serializeDeclarations(
        declarations,
        document,
        namespace,
        allowed,
      );
      if (body) rules.push(`${selector}${stateSuffix(state)}{${body}}`);
    }
    if (rules.length === 0) continue;
    const content = rules.join("\n");
    output.push(
      breakpoint === "desktop"
        ? content
        : `@media (max-width:${breakpoint === "tablet" ? document.settings.breakpoints.tabletMax : document.settings.breakpoints.mobileMax}px){${content}}`,
    );
  }
}

function serializeDeclarations(
  declarations: StyleDeclarations,
  document: PageDocument,
  namespace: string,
  allowed: ReadonlySet<string>,
): string {
  return Object.keys(declarations)
    .sort()
    .map((property) => {
      if (!allowed.has(property))
        invalid(
          `Style property ${property} is not registered by a Style capability.`,
        );
      return `${property}:${serializeValue(declarations[property]!, document, namespace)}`;
    })
    .join(";");
}

function serializeValue(
  value: StyleValue,
  document: PageDocument,
  namespace: string,
): string {
  if (typeof value === "object") {
    if (!document.variables[value.variableId])
      invalid(`Style references missing Variable ${value.variableId}.`);
    return `var(--pb-${namespace}-v-${escapeIdentifier(value.variableId)})`;
  }
  return serializePrimitive(value);
}

function serializePrimitive(value: string | number): string {
  const serialized = String(value);
  if (
    !Number.isFinite(typeof value === "number" ? value : 0) ||
    unsafeValuePattern.test(serialized) ||
    [...serialized].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127;
    })
  )
    invalid(
      "Style values cannot contain control characters or CSS rule delimiters.",
    );
  return serialized;
}

function stateSuffix(state: StyleState): string {
  return state === "normal"
    ? ""
    : state === "hover"
      ? ":hover"
      : ":focus-visible";
}

function preorder(document: PageDocument): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    result.push(id);
    for (const child of document.elements[id]!.children) visit(child);
  };
  visit(document.rootId);
  return result;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeIdentifier(value: string): string {
  return [...value]
    .map((character) =>
      /[A-Za-z0-9_-]/u.test(character)
        ? character
        : `\\${character.codePointAt(0)!.toString(16)} `,
    )
    .join("");
}

function invalid(message: string): never {
  throw new PagebldrError("INVALID_CONFIGURATION", message);
}

function duplicate(kind: string, key: string): never {
  throw new PagebldrError(
    "DUPLICATE_REGISTRATION",
    `Duplicate ${kind} ${key}.`,
  );
}
