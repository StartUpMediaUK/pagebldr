import type {
  Breakpoint,
  PageDocument,
  ResponsiveStyles,
  StyleDeclarations,
  StyleState,
  StyleValue,
  VariableKind,
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
  readonly resolve: (
    document: PageDocument,
    elementId: string,
    breakpoint: Breakpoint,
    state?: StyleState,
  ) => ResolvedStyles;
  readonly variableKindsForProperty: (
    property: string,
  ) => readonly VariableKind[];
}

export interface ResolvedStyleSource {
  readonly sourceType: "class" | "local";
  readonly sourceId: string;
  readonly breakpoint: Breakpoint;
  readonly state: StyleState;
  readonly inherited: boolean;
}

export interface ResolvedStyleValue {
  readonly value: StyleValue;
  readonly source: ResolvedStyleSource;
}

export type ResolvedStyles = Readonly<Record<string, ResolvedStyleValue>>;

const keyPattern = /^[a-z][a-z0-9-]*$/u;
const propertyPattern = /^(?:--[a-z][a-z0-9-]*|[a-z][A-Za-z0-9]*)$/u;
const unsafeValuePattern =
  /[;{}<>]|\/\*|\*\/|javascript\s*:|expression\s*\(|@import/iu;
const breakpoints: readonly Breakpoint[] = ["desktop", "tablet", "mobile"];
const states: readonly StyleState[] = ["normal", "hover", "focusVisible"];

const variableProperties: Readonly<Record<VariableKind, readonly string[]>> = {
  color: ["color", "backgroundColor", "borderColor"],
  typography: ["fontFamily"],
  spacing: [
    "gap",
    "columnGap",
    "rowGap",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "top",
    "right",
    "bottom",
    "left",
  ],
  radius: ["borderRadius"],
  shadow: ["boxShadow"],
  contentWidth: ["width", "minWidth", "maxWidth"],
};

export function styleVariableKindsForProperty(
  property: string,
): readonly VariableKind[] {
  return (Object.keys(variableProperties) as VariableKind[]).filter((kind) =>
    variableProperties[kind].includes(property),
  );
}

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
    for (const property of definition.properties) properties.add(property);
    capabilities.set(definition.key, definition);
  }
  return Object.freeze({
    capabilities,
    properties,
    compile: (document: PageDocument) =>
      compileDocumentStyles(namespace, document, properties),
    resolve: (
      document: PageDocument,
      elementId: string,
      breakpoint: Breakpoint,
      state: StyleState = "normal",
    ) => resolveElementStyles(document, elementId, breakpoint, state),
    variableKindsForProperty: styleVariableKindsForProperty,
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
      if (body) {
        if (state === "normal")
          rules.push(`${equalSpecificityNormalSelector(selector)}{${body}}`);
        else
          rules.push(
            `${selector}${stateSuffix(state)},${selector}[data-pagebldr-force-state="${state}"]{${body}}`,
          );
      }
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

function equalSpecificityNormalSelector(selector: string): string {
  const finalCompoundIndex = selector.lastIndexOf(" ");
  if (finalCompoundIndex < 0) return `${selector}${selector}`;
  return `${selector}${selector.slice(finalCompoundIndex + 1)}`;
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
      return `${toKebabCase(property)}:${serializeValue(declarations[property]!, document, namespace, property)}`;
    })
    .join(";");
}

function serializeValue(
  value: StyleValue,
  document: PageDocument,
  namespace: string,
  property?: string,
): string {
  if (typeof value === "object") {
    if (!document.variables[value.variableId])
      invalid(`Style references missing Variable ${value.variableId}.`);
    return `var(--pb-${namespace}-v-${escapeIdentifier(value.variableId)})`;
  }
  return serializePrimitive(value, property);
}

function serializePrimitive(value: string | number, property?: string): string {
  const serialized = String(value);
  const urls = [...serialized.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/giu)];
  const hasUrlSyntax = /url\s*\(/iu.test(serialized);
  const urlsAreSafe =
    !hasUrlSyntax ||
    ((property === "background" || property === "backgroundImage") &&
      urls.length > 0 &&
      urls.every((match) => /^https?:\/\//iu.test(match[1] ?? "")));
  if (
    !Number.isFinite(typeof value === "number" ? value : 0) ||
    unsafeValuePattern.test(serialized) ||
    !urlsAreSafe ||
    [...serialized].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127;
    })
  )
    invalid("A style value contains unsafe CSS syntax.");
  return serialized;
}

function toKebabCase(property: string): string {
  return property.replace(
    /[A-Z]/gu,
    (character) => `-${character.toLowerCase()}`,
  );
}

export function resolveElementStyles(
  document: PageDocument,
  elementId: string,
  breakpoint: Breakpoint,
  state: StyleState = "normal",
): ResolvedStyles {
  const element = document.elements[elementId];
  if (!element)
    throw new PagebldrError(
      "ELEMENT_NOT_FOUND",
      `Element ${elementId} does not exist.`,
    );
  const resolved: Record<string, ResolvedStyleValue> = {};
  for (const classId of element.classIds) {
    const styleClass = document.classes[classId];
    if (!styleClass)
      throw new PagebldrError(
        "BROKEN_REFERENCE",
        `Element ${elementId} references missing Class ${classId}.`,
      );
    Object.assign(
      resolved,
      resolveStyleLayer(styleClass.styles, breakpoint, state, "class", classId),
    );
  }
  Object.assign(
    resolved,
    resolveStyleLayer(element.styles, breakpoint, state, "local", elementId),
  );
  return Object.freeze(resolved);
}

function resolveStyleLayer(
  styles: ResponsiveStyles,
  breakpoint: Breakpoint,
  state: StyleState,
  sourceType: ResolvedStyleSource["sourceType"],
  sourceId: string,
): ResolvedStyles {
  const resolved: Record<string, ResolvedStyleValue> = {};
  const chain = breakpoints.slice(0, breakpoints.indexOf(breakpoint) + 1);
  for (const currentBreakpoint of chain) {
    const stateStyles = styles[currentBreakpoint];
    if (!stateStyles) continue;
    const layers: readonly (readonly [
      StyleState,
      StyleDeclarations | undefined,
    ])[] =
      state === "normal"
        ? [["normal", stateStyles.normal]]
        : [
            ["normal", stateStyles.normal],
            [state, stateStyles[state]],
          ];
    for (const [currentState, declarations] of layers) {
      if (!declarations) continue;
      for (const [property, value] of Object.entries(declarations)) {
        resolved[property] = {
          value,
          source: {
            sourceType,
            sourceId,
            breakpoint: currentBreakpoint,
            state: currentState,
            inherited: currentBreakpoint !== breakpoint,
          },
        };
      }
    }
  }
  return resolved;
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
