import type { Pagebldr } from "./config.js";
import type { PageDocument } from "./document-types.js";
import type { ResourceContext, ResourceReference } from "./types.js";
import { extractDocumentReferences, resourceKey } from "./resources.js";
import type { StandardSchemaResult } from "./schema.js";

export interface PublicationIssue {
  readonly id: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly elementId?: string;
  readonly path?: string;
}

export interface PublicationValidationOptions {
  readonly context?: ResourceContext;
  /** Host policy for neutral application destinations or other Resources. */
  readonly checkReference?: (
    reference: ResourceReference,
    context: ResourceContext,
  ) => Promise<"available" | "missing" | "unpublished">;
}

export async function validatePublication(
  builder: Pagebldr,
  source: PageDocument,
  options: PublicationValidationOptions = {},
): Promise<readonly PublicationIssue[]> {
  const document = builder.documents.migrate(source);
  const issues: PublicationIssue[] = [];
  for (const element of Object.values(document.elements)) {
    const definition = builder.elements.get(element.type);
    for (const issue of definition?.publicationIssues?.(element.props) ?? [])
      issues.push({
        ...issue,
        id: `${element.id}:${issue.code}:${issue.path ?? ""}`,
        severity: "error",
        elementId: element.id,
      });
  }
  for (const reference of extractDocumentReferences(builder, document)) {
    const id = resourceKey(reference);
    const adapter = builder.resources.get(reference.kind);
    let availability: "available" | "missing" | "unpublished" = "missing";
    if (adapter) {
      const validated = (await adapter.reference["~standard"].validate(
        reference.value,
      )) as StandardSchemaResult<unknown>;
      if ("value" in validated) {
        const context = options.context ?? {};
        const url = await adapter.resolve(validated.value, context);
        const media = adapter.media?.lookup
          ? await adapter.media.lookup(reference, context)
          : undefined;
        availability =
          url === null || (media !== undefined && (!media || !media.available))
            ? "missing"
            : options.checkReference
              ? await options.checkReference(reference, context)
              : "available";
      }
    }
    if (availability !== "available")
      issues.push({
        id,
        severity: availability === "missing" ? "error" : "warning",
        message:
          availability === "missing"
            ? `Resource ${reference.kind} is missing or unavailable.`
            : `Resource ${reference.kind} is not published. Publish anyway only after reviewing this destination.`,
      });
  }
  return Object.freeze(issues);
}
