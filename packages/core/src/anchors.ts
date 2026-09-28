export interface AuthoredAnchor {
  readonly elementId: string;
  readonly anchorId: unknown;
}

export function normalizeAnchorId(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^[^a-z]+/u, "")
    .replace(/-+$/gu, "")
    .slice(0, 80);
}

export function isAnchorIdDuplicate(
  anchors: Iterable<AuthoredAnchor>,
  elementId: string,
  anchorId: string,
): boolean {
  return (
    anchorId.length > 0 &&
    [...anchors].some(
      (candidate) =>
        candidate.elementId !== elementId && candidate.anchorId === anchorId,
    )
  );
}
