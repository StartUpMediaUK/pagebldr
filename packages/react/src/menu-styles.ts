import type { PageDocument } from "@pagebldr/core";

// Widget layout uses the same Document breakpoints as authored styles. Keep
// these rules SSR-generated: a closed Menu must not flash its links before hydration.
export function menuResponsiveStyles(
  namespace: string,
  document: PageDocument,
): string {
  const escape = (value: string) =>
    value.replace(
      /[^a-zA-Z0-9_-]/g,
      (character) => `\\${character.codePointAt(0)!.toString(16)} `,
    );
  const scope = `[data-pagebldr="${escape(namespace)}"][data-pagebldr-document="${escape(document.id)}"]`;
  return (["desktop", "tablet", "mobile"] as const)
    .map((breakpoint) => {
      const menu = `${scope} .pagebldr-menu[data-collapse-at="${breakpoint}"]`;
      const rules = `
${menu}[data-breakpoint-position="start"]{order:-2147483647;margin-inline:0 auto}
${menu}[data-breakpoint-position="center"]{order:0;margin-inline:auto}
${menu}[data-breakpoint-position="end"]{order:2147483647;margin-inline:auto 0}
${menu} .pagebldr-menu-toggle{display:inline-flex}
${menu} .pagebldr-menu-panel{display:none;position:fixed;inset-inline:0;top:var(--pagebldr-menu-boundary,0px);z-index:100;max-height:calc(100dvh - var(--pagebldr-menu-boundary,0px));overflow:auto;padding:var(--pagebldr-menu-panel-padding);background:var(--pagebldr-menu-panel-background)}
${menu}[data-open="true"] .pagebldr-menu-panel{display:block}
${menu} .pagebldr-menu-list{flex-direction:column;align-items:stretch}
${menu}[data-item-appearance="background"] .pagebldr-menu-list>li,${menu}[data-item-appearance="background"] .pagebldr-menu-link{width:100%}
${menu}[data-item-appearance="background"] .pagebldr-menu-link{display:flex;padding:.75em 1em;background:var(--pagebldr-menu-item-background);text-decoration:none}
${menu}[data-item-appearance="background"] .pagebldr-menu-link:hover{background:var(--pagebldr-menu-item-hover-background)}
${menu}[data-presentation="fullscreen"] .pagebldr-menu-panel{inset:0;max-height:100dvh;overflow:hidden}
${menu}[data-presentation="fullscreen"][data-open="true"] .pagebldr-menu-panel{display:grid;grid-template-rows:auto minmax(0,1fr)}
${menu}[data-presentation="fullscreen"][data-open="true"] .pagebldr-menu-toggle{position:fixed;inset-block-start:var(--pagebldr-menu-panel-padding);inset-inline-end:var(--pagebldr-menu-panel-padding);z-index:101}
${menu}[data-presentation="fullscreen"] .pagebldr-menu-fullscreen-header{display:flex;min-height:2.5rem;align-items:center;padding-inline-end:calc(2.5rem + var(--pagebldr-menu-item-gap))}
${menu}[data-presentation="fullscreen"] .pagebldr-menu-list{width:100%;min-height:0;overflow:auto}
${menu}[data-presentation="fullscreen"] .pagebldr-menu-list>li,${menu}[data-presentation="fullscreen"] .pagebldr-menu-link{width:100%}
${menu}[data-presentation="fullscreen"] .pagebldr-menu-link{display:flex}
${menu}[data-presentation="fullscreen"][data-fullscreen-vertical-alignment="start"] .pagebldr-menu-list{justify-content:flex-start}
${menu}[data-presentation="fullscreen"][data-fullscreen-vertical-alignment="center"] .pagebldr-menu-list{justify-content:center}
${menu}[data-presentation="fullscreen"][data-fullscreen-vertical-alignment="end"] .pagebldr-menu-list{justify-content:flex-end}`;
      return breakpoint === "desktop"
        ? rules
        : `@media (max-width:${breakpoint === "tablet" ? document.settings.breakpoints.tabletMax : document.settings.breakpoints.mobileMax}px){${rules}}`;
    })
    .join("\n");
}
