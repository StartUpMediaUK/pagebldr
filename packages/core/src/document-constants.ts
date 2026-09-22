export const DOCUMENT_FORMAT = "pagebldr" as const;
export const DOCUMENT_SCHEMA_VERSION = 2 as const;
export const MAX_DOCUMENT_ELEMENTS = 5_000;
export const MAX_DOCUMENT_DEPTH = 500;
export const MAX_ELEMENT_CHILDREN = 5_000;
export const MAX_ELEMENT_CLASSES = 32;

export const BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export const STYLE_STATES = ["normal", "hover", "focusVisible"] as const;
export const VARIABLE_KINDS = [
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "contentWidth",
] as const;
