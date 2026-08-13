# Phase 5 audit — styling engine

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The framework-independent styling engine is implemented behind `builder.styles`.
It compiles responsive authored styles into deterministic CSS scoped to the
configured builder namespace and Document ID. The same compiler serves
extraction, SSR, preview, and published rendering without depending on React,
the DOM, Tailwind, or a framework runtime.

Package-owned editor and renderer baseline CSS ships separately through
`pagebldr/styles.css`, with documented semantic theme variables and
reduced-motion behavior.

## Changed interfaces

- `defineStyleCapability()` defines a named, immutable group of allowed CSS
  properties.
- `PagebldrOptions.styleCapabilities` registers those definitions and rejects
  duplicate capability keys or property ownership.
- `builder.styles` exposes immutable capability/property views and
  `compile(document)`.
- Compilation returns CSS plus the public scope attributes renderers must apply.
- `pagebldr/styles.css` is an explicit package export containing package-shell
  CSS, not Document-authored rules.

CSS order is fixed: Variables, ordered Classes, and preorder Elements, each with
desktop, tablet, then mobile rules and normal, hover, then focus-visible states.
Element rules consequently override reusable Class rules. Declarations are
property-sorted, variable references become namespace-scoped custom properties,
and hidden Elements receive an explicit rule.

## Verification performed

- Byte-identical compilation across cloned Documents.
- Responsive cascade, pseudo-state output, Variable resolution, Class/Element
  precedence, hidden Elements, and stable declaration order.
- Rejection of duplicate definitions, unregistered properties, missing
  Variables, non-finite numbers, CSS delimiters, and control characters.
- A 500-Element styled Document stays below the 100 KB authored-CSS guardrail.
- Packed-package verification checks the documented theme CSS is distributed.
- Formatting, lint, TypeScript, complete tests, build, package analysis,
  packed-consumer, licence, and diff gates are required before commit.

## Documentation

The public interface documents Style capability registration, compiled output,
scope attributes, theme variables, extraction, SSR, and CSP nonce/hash
responsibilities.

## Deferred work and risks

- Element-specific Style capability assignment and the complete standard
  capability library land with Element definitions in Phase 6.
- Renderer attachment of the documented scope, Element, and Class attributes
  lands with the renderer in Phase 6.
- The Host owns CSP headers and nonce generation. The package returns pure CSS
  and does not weaken or infer Host policy.
- No deployment, publication, push, or external-system change occurred.

## Commit

To be recorded after product-owner review and authorization.
