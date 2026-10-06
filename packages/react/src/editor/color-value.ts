import Color from "color";

export function normalizeColor(value: string, allowAlpha: boolean): string {
  try {
    const color = Color(value.trim());
    return allowAlpha && color.alpha() < 1 ? color.rgb().string() : color.hex();
  } catch {
    throw new Error("Enter a valid colour.");
  }
}

export function changedColor(
  current: string,
  next: string,
  allowAlpha: boolean,
): string | null {
  const normalized = normalizeColor(next, allowAlpha);
  try {
    if (Color(current).hexa() === Color(normalized).hexa()) return null;
  } catch {
    /* Empty/unset values can still be authored. */
  }
  return normalized;
}

export function selectionColor(
  hue: number,
  x: number,
  y: number,
  alpha: number,
): string {
  return normalizeColor(
    Color.hsl(
      hue,
      Math.max(0, Math.min(1, x)) * 100,
      (Math.max(0, Math.min(1, x)) < 0.01
        ? 100
        : 100 - Math.max(0, Math.min(1, x)) * 50) *
        (1 - Math.max(0, Math.min(1, y))),
    )
      .alpha(alpha)
      .rgb()
      .string(),
    true,
  );
}
