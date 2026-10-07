import { normalizeColor } from "./color-value.js";

export function parseLength(value: string): {
  amount: number | null;
  unit: string;
} {
  const match = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(value.trim());
  return match
    ? { amount: Number(match[1]), unit: match[2] ?? "" }
    : { amount: null, unit: value.trim() };
}

export function formatLength(draft: string, unit: string): string {
  if (!draft.trim() || !Number.isFinite(Number(draft)))
    throw new Error("Enter a number.");
  return `${Number(draft)}${unit}`;
}

export type BackgroundLayers = {
  mode: "none" | "image" | "gradient" | "overlay";
  angle: number;
  start: string;
  end: string;
  image: string;
};

export function backgroundLayers(value: string): BackgroundLayers {
  const gradient =
    /linear-gradient\((-?\d+(?:\.\d+)?)deg,\s*(#[0-9a-f]{6,8}),\s*(#[0-9a-f]{6,8})\)/i.exec(
      value,
    );
  const url = /url\(("(?:\\.|[^"])*")\)/.exec(value);
  let image = "";
  try {
    image = url?.[1] ? (JSON.parse(url[1]) as string) : "";
  } catch {
    /* Unsupported values remain resettable. */
  }
  return {
    mode:
      gradient && url
        ? "overlay"
        : gradient
          ? "gradient"
          : url
            ? "image"
            : "none",
    angle: Number(gradient?.[1] ?? 135),
    start: gradient?.[2] ?? "#7659e7",
    end: gradient?.[3] ?? "#172033",
    image,
  };
}

export function buildBackgroundLayers(layers: BackgroundLayers): string | null {
  if (layers.mode === "none") return null;
  let image = "";
  if (layers.image) {
    const url = new URL(layers.image);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Use an HTTP or HTTPS image URL.");
    image = `url(${JSON.stringify(url.toString())})`;
  }
  if (layers.mode === "image") return image || null;
  if (!Number.isFinite(layers.angle) || Math.abs(layers.angle) > 360)
    throw new Error("Enter an angle from -360 to 360 degrees.");
  normalizeColor(layers.start, true);
  normalizeColor(layers.end, true);
  const gradient = `linear-gradient(${layers.angle}deg, ${layers.start}, ${layers.end})`;
  return layers.mode === "overlay" && image
    ? `${gradient}, ${image}`
    : gradient;
}

export type EffectProperty =
  "transform" | "filter" | "backdropFilter" | "boxShadow";
export function effectValues(
  property: EffectProperty,
  value: string,
): Record<string, string> {
  if (property === "transform") {
    const match =
      /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)\s+rotate\((-?\d+(?:\.\d+)?)deg\)\s+scale\((\d+(?:\.\d+)?)\)/.exec(
        value,
      );
    return {
      x: match?.[1] ?? "0",
      y: match?.[2] ?? "0",
      rotate: match?.[3] ?? "0",
      scale: match?.[4] ?? "1",
    };
  }
  if (property === "boxShadow") {
    const match =
      /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.+?)(\s+inset)?$/.exec(
        value,
      );
    return {
      x: match?.[1] ?? "0",
      y: match?.[2] ?? "4",
      blur: match?.[3] ?? "12",
      spread: match?.[4] ?? "0",
      color: match?.[5] ?? "rgba(15, 23, 42, 0.16)",
      inset: match?.[6] ? "true" : "false",
    };
  }
  return {
    blur: /blur\((\d+(?:\.\d+)?)px\)/.exec(value)?.[1] ?? "0",
    brightness: /brightness\((\d+(?:\.\d+)?)%\)/.exec(value)?.[1] ?? "100",
    grayscale: /grayscale\((\d+(?:\.\d+)?)%\)/.exec(value)?.[1] ?? "0",
  };
}

export function buildEffect(
  property: EffectProperty,
  values: Readonly<Record<string, string>>,
): string {
  const number = (key: string, min = -Infinity, max = Infinity) => {
    const draft = values[key] ?? "";
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value) || value < min || value > max)
      throw new Error(
        `Enter a valid ${key} value${min === 0 ? " (zero or greater)" : ""}.`,
      );
    return value;
  };
  if (property === "transform")
    return `translate(${number("x")}px, ${number("y")}px) rotate(${number("rotate")}deg) scale(${number("scale", 0)})`;
  if (property === "boxShadow") {
    normalizeColor(values.color ?? "", true);
    return `${number("x")}px ${number("y")}px ${number("blur", 0)}px ${number("spread")}px ${values.color}${values.inset === "true" ? " inset" : ""}`;
  }
  return `blur(${number("blur", 0)}px) brightness(${number("brightness", 0)}%)${property === "filter" ? ` grayscale(${number("grayscale", 0, 100)}%)` : ""}`;
}
