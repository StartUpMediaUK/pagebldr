import type { Pagebldr } from "./config.js";
import type { PageDocument } from "./document-types.js";
import type {
  PreparedResources,
  ResourceContext,
  ResourceReference,
} from "./types.js";
import { PagebldrError } from "./types.js";
import type { StandardSchemaResult } from "./schema.js";

export function resourceKey(reference: ResourceReference): string {
  return `${reference.kind}:${stableJson(reference.value)}`;
}

/** Typed Element references plus Document-level SEO media, deduplicated. */
export function extractDocumentReferences(
  builder: Pagebldr,
  document: PageDocument,
): readonly ResourceReference[] {
  const references = new Map<string, ResourceReference>();
  for (const element of Object.values(document.elements)) {
    const definition = builder.elements.get(element.type);
    for (const reference of definition?.references?.(element.props) ?? [])
      references.set(resourceKey(reference), reference);
  }
  if (document.settings.seo.socialImage) {
    const reference = document.settings.seo.socialImage;
    references.set(resourceKey(reference), reference);
  }
  return structuredClone([...references.values()]);
}

export async function resolveDocumentResources(
  builder: Pagebldr,
  document: PageDocument,
  context: ResourceContext = {},
): Promise<PreparedResources> {
  const references = extractDocumentReferences(builder, document);
  const values = new Map<string, string | null>();
  await Promise.all(
    references.map(async (reference) => {
      const key = resourceKey(reference);
      const adapter = builder.resources.get(reference.kind);
      if (!adapter)
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `No Resource adapter is registered for ${reference.kind}.`,
        );
      const result = (await adapter.reference["~standard"].validate(
        reference.value,
      )) as StandardSchemaResult<unknown>;
      if (!("value" in result))
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Resource reference ${key} is invalid.`,
          { details: { issues: result.issues } },
        );
      values.set(key, await adapter.resolve(result.value, context));
    }),
  );
  return Object.freeze({ values });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
