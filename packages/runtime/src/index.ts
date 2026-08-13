import type { Pagebldr, PageDocument, PreparedResources } from "@pagebldr/core";
import { resolveDocumentResources } from "@pagebldr/core";

export * from "./events.js";
export {
  pagebldrCacheTag,
  pagebldrMetadata,
  pagebldrRouteResult,
} from "./next.js";
import type { EventDelivery } from "./events.js";

export type RuntimeResolution =
  | { readonly status: "found"; readonly page: PublishedPage }
  | { readonly status: "notFound" }
  | {
      readonly status: "redirect";
      readonly location: string;
      readonly permanent: boolean;
    }
  | { readonly status: "error"; readonly error: Error };

export interface PublishedPage {
  readonly document: PageDocument;
  readonly canonicalPath: string;
  readonly canonicalUrl?: string;
  readonly cacheIdentity: string;
  readonly resources: PreparedResources;
  readonly metadata: {
    readonly title: string;
    readonly description: string;
    readonly noIndex: boolean;
  };
  readonly eventContext: {
    readonly namespace: string;
    readonly scope?: Readonly<Record<string, string>>;
  };
}

export type PublicationResolution =
  | PageDocument
  | null
  | { readonly redirect: string; readonly permanent?: boolean };

export interface PublicationSource {
  readonly resolve: (request: {
    readonly path: string;
    readonly scope?: Readonly<Record<string, string>>;
  }) => Promise<PublicationResolution>;
}

export interface PagebldrRuntimeOptions {
  readonly builder: Pagebldr;
  readonly publications: PublicationSource;
  readonly canonicalOrigin?: string;
  readonly events?: EventDelivery;
}

export interface RuntimeRequest {
  readonly path: string;
  readonly scope?: Readonly<Record<string, string>>;
}

export function createPagebldrRuntime(options: PagebldrRuntimeOptions) {
  return Object.freeze({
    builder: options.builder,
    resolve: async (request: RuntimeRequest): Promise<RuntimeResolution> => {
      try {
        const path = normalizePath(request.path);
        const resolution = await options.publications.resolve({
          path,
          ...(request.scope ? { scope: request.scope } : {}),
        });
        if (!resolution) return { status: "notFound" };
        if ("redirect" in resolution)
          return {
            status: "redirect",
            location: normalizePath(resolution.redirect),
            permanent: resolution.permanent ?? false,
          };
        const document = options.builder.documents.migrate(resolution);
        const resources = await resolveDocumentResources(
          options.builder,
          document,
          request.scope ? { scope: request.scope } : {},
        );
        const canonicalUrl = options.canonicalOrigin
          ? new URL(path, normalizedOrigin(options.canonicalOrigin)).href
          : undefined;
        return {
          status: "found",
          page: {
            document,
            canonicalPath: path,
            ...(canonicalUrl ? { canonicalUrl } : {}),
            cacheIdentity: `${options.builder.namespace}:${document.id}:${document.schemaVersion}:${stableScope(request.scope)}`,
            resources,
            metadata: {
              title: document.settings.metadata.title || document.title,
              description: document.settings.metadata.description,
              noIndex: document.settings.metadata.noIndex,
            },
            eventContext: {
              namespace: options.builder.namespace,
              ...(request.scope ? { scope: request.scope } : {}),
            },
          },
        };
      } catch (error) {
        return {
          status: "error",
          error:
            error instanceof Error
              ? error
              : new Error("Page resolution failed.", { cause: error }),
        };
      }
    },
    recordVisit: async (
      page: PublishedPage,
      data: { readonly referrer?: string } = {},
    ) =>
      options.events?.analytics({
        type: "page.visit",
        context: page.eventContext,
        subject: { documentId: page.document.id },
        data: {
          path: page.canonicalPath,
          ...(data.referrer
            ? { referrerOrigin: safeOrigin(data.referrer) }
            : {}),
        },
      }) ?? null,
  });
}

export function normalizePath(input: string): string {
  const pathname =
    input.startsWith("http://") || input.startsWith("https://")
      ? new URL(input).pathname
      : input.split(/[?#]/u, 1)[0]!;
  const decoded = pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean);
  if (decoded.some((segment) => segment === "." || segment === ".."))
    throw new TypeError("Runtime paths cannot traverse directories.");
  const normalized = `/${decoded.map(encodeURIComponent).join("/")}`;
  return normalized === "/" ? normalized : normalized.replace(/\/+$/u, "");
}

function normalizedOrigin(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.host}/`;
}

function stableScope(scope?: Readonly<Record<string, string>>): string {
  return Object.entries(scope ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function safeOrigin(input: string): string {
  try {
    return new URL(input).origin;
  } catch {
    return "invalid";
  }
}
