import type { ElementDefinition } from "./element.js";
import { createEditor, type EditorEngine } from "./editor.js";
import { createDocuments, type Documents } from "./documents.js";
import type { DocumentMigration } from "./migrations.js";
import type { BlockDefinition, TemplateDefinition } from "./factories.js";
import {
  createStyleEngine,
  type StyleCapabilityDefinition,
  type StyleEngine,
} from "./styles.js";
import { PagebldrError, type ResourceAdapter } from "./types.js";

export interface PagebldrOptions {
  readonly namespace: string;
  readonly elements?: readonly ElementDefinition[];
  readonly migrations?: readonly DocumentMigration[];
  readonly resources?: Readonly<Record<string, ResourceAdapter>>;
  readonly styleCapabilities?: readonly StyleCapabilityDefinition[];
  readonly blocks?: readonly BlockDefinition[];
  readonly templates?: readonly TemplateDefinition[];
}

export interface Pagebldr<Options extends PagebldrOptions = PagebldrOptions> {
  readonly namespace: Options["namespace"];
  readonly elements: ReadonlyMap<string, ElementDefinition>;
  readonly resources: ReadonlyMap<string, ResourceAdapter>;
  readonly documents: Documents;
  readonly editor: EditorEngine;
  readonly styles: StyleEngine;
  readonly blocks: ReadonlyMap<string, BlockDefinition>;
  readonly templates: ReadonlyMap<string, TemplateDefinition>;
}

const namespacePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export function createPagebldr<const Options extends PagebldrOptions>(
  options: Options,
): Pagebldr<Options> {
  if (!namespacePattern.test(options.namespace)) {
    throw new PagebldrError(
      "INVALID_NAMESPACE",
      "The namespace must use lowercase kebab-case.",
      { details: { namespace: options.namespace } },
    );
  }

  const elements = new Map<string, ElementDefinition>();
  for (const definition of options.elements ?? []) {
    if (elements.has(definition.type)) {
      throw new PagebldrError(
        "DUPLICATE_REGISTRATION",
        `Element type ${definition.type} is registered more than once.`,
        { details: { kind: "element", key: definition.type } },
      );
    }
    elements.set(definition.type, definition);
  }

  const resources = new Map<string, ResourceAdapter>();
  for (const [kind, adapter] of Object.entries(options.resources ?? {})) {
    if (!namespacePattern.test(kind)) {
      throw new PagebldrError(
        "INVALID_CONFIGURATION",
        `Resource kind ${kind} must use lowercase kebab-case.`,
        { details: { kind: "resource", key: kind } },
      );
    }
    resources.set(kind, adapter);
  }
  const blocks = keyedDefinitions("Block", options.blocks ?? []);
  const templates = keyedDefinitions("Template", options.templates ?? []);
  const styles = createStyleEngine(
    options.namespace,
    options.styleCapabilities ?? [],
  );
  for (const definition of elements.values()) {
    for (const capability of definition.styles ?? [])
      if (!styles.capabilities.has(capability))
        throw new PagebldrError(
          "INVALID_CONFIGURATION",
          `Element ${definition.type} references unregistered Style capability ${capability}.`,
        );
  }

  return Object.freeze({
    namespace: options.namespace,
    elements,
    resources,
    documents: createDocuments(elements, options.migrations ?? [], styles),
    editor: createEditor(elements, styles),
    styles,
    blocks,
    templates,
  });
}

function keyedDefinitions<Definition extends { readonly key: string }>(
  kind: string,
  definitions: readonly Definition[],
): ReadonlyMap<string, Definition> {
  const result = new Map<string, Definition>();
  for (const definition of definitions) {
    if (!namespacePattern.test(definition.key))
      throw new PagebldrError(
        "INVALID_CONFIGURATION",
        `${kind} key ${definition.key} must use lowercase kebab-case.`,
      );
    if (result.has(definition.key))
      throw new PagebldrError(
        "DUPLICATE_REGISTRATION",
        `${kind} ${definition.key} is registered more than once.`,
      );
    result.set(definition.key, definition);
  }
  return result;
}
