import type { PublishedPage, RuntimeResolution } from "./index.js";

export function pagebldrMetadata(page: PublishedPage) {
  return {
    title: page.metadata.title,
    description: page.metadata.description,
    ...(page.canonicalUrl
      ? { alternates: { canonical: page.canonicalUrl } }
      : {}),
    robots: { index: !page.metadata.noIndex, follow: !page.metadata.noIndex },
  };
}

export function pagebldrCacheTag(page: PublishedPage): string {
  return `pagebldr:${page.cacheIdentity}`;
}

export function pagebldrRouteResult(resolution: RuntimeResolution) {
  if (resolution.status === "found")
    return { kind: "render" as const, page: resolution.page };
  if (resolution.status === "redirect")
    return {
      kind: "redirect" as const,
      location: resolution.location,
      permanent: resolution.permanent,
    };
  if (resolution.status === "notFound") return { kind: "notFound" as const };
  return { kind: "error" as const, error: resolution.error };
}
