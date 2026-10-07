import type {
  Breakpoint,
  ResponsiveStyles,
  StyleState,
  StyleValue,
} from "@pagebldr/core";

export function replaceStyleProperties(
  styles: ResponsiveStyles,
  breakpoint: Breakpoint,
  state: StyleState,
  properties: readonly string[],
  value: StyleValue | null,
): ResponsiveStyles {
  const next = { ...structuredClone(styles) };
  const states = { ...next[breakpoint] };
  const declarations = { ...states[state] };
  for (const property of properties) {
    if (value === null) delete declarations[property];
    else declarations[property] = value;
  }
  if (Object.keys(declarations).length) states[state] = declarations;
  else delete states[state];
  if (Object.keys(states).length) next[breakpoint] = states;
  else delete next[breakpoint];
  return next;
}
