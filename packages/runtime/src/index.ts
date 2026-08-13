import type { Pagebldr, PageDocument, PreparedResources } from "@pagebldr/core";

export type RuntimeResolution =
  | { readonly status: "found"; readonly page: PublishedPage }
  | { readonly status: "notFound" }
  | { readonly status: "redirect"; readonly location: string }
  | { readonly status: "error"; readonly error: Error };

export interface PublishedPage {
  readonly document: PageDocument;
  readonly canonicalPath: string;
  readonly resources: PreparedResources;
  readonly metadata: { readonly title: string };
}

export interface PublicationSource {
  readonly resolve: (request: {
    readonly path: string;
    readonly scope?: Readonly<Record<string, string>>;
  }) => Promise<PageDocument | null>;
}

export interface PagebldrRuntimeOptions {
  readonly builder: Pagebldr;
  readonly publications: PublicationSource;
}

export function createPagebldrRuntime(options: PagebldrRuntimeOptions) {
  return Object.freeze({
    builder: options.builder,
    resolve: async (request: {
      readonly path: string;
      readonly scope?: Readonly<Record<string, string>>;
    }): Promise<RuntimeResolution> => {
      const document = await options.publications.resolve(request);
      if (!document) return { status: "notFound" };
      return {
        status: "found",
        page: {
          document,
          canonicalPath: request.path,
          resources: { values: new Map() },
          metadata: { title: document.title },
        },
      };
    },
  });
}
