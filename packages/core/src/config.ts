import type { ElementDefinition } from "./element.js";
import { createEditor, type EditorEngine } from "./editor.js";
import { createDocuments, type Documents } from "./documents.js";
import type { DocumentMigration } from "./migrations.js";
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
}

export interface Pagebldr<Options extends PagebldrOptions = PagebldrOptions> {
  readonly namespace: Options["namespace"];
  readonly elements: ReadonlyMap<string, ElementDefinition>;
  readonly resources: ReadonlyMap<string, ResourceAdapter>;
  readonly documents: Documents;
  readonly editor: EditorEngine;
  readonly styles: StyleEngine;
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

  return Object.freeze({
    namespace: options.namespace,
    elements,
    resources,
    documents: createDocuments(elements, options.migrations ?? []),
    editor: createEditor(elements),
    styles: createStyleEngine(
      options.namespace,
      options.styleCapabilities ?? [],
    ),
  });
}
