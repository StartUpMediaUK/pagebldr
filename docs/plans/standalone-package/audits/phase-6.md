# Phase 6 audit — definitions, standard library, and renderer

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

Element definitions now provide one coherent extension unit across validation,
defaults, child policy, Style capabilities, migrations, Controls, accessibility,
Resource extraction, and rendering. Core definitions return a small
framework-neutral render tree; the React renderer translates it without a
central Element-type switch and remains SSR safe.

The standard library includes container, heading, text, button/link, image,
video, icon, divider, spacer, list, accordion, tabs, testimonial, rating,
counter, countdown, social links, logo cloud, and gallery Elements. It also
provides standard layout, typography, and decoration Style capabilities.

## Changed interfaces

- `ElementDefinition` now includes child policy, Style capabilities,
  accessibility metadata, definition-owned rendering, Controls, and Resource
  reference extraction.
- `standardElements` and `standardStyleCapabilities` provide the opt-in standard
  library.
- `resolveDocumentResources()` validates, deduplicates, and resolves references
  before synchronous rendering; `resourceKey()` provides stable lookup identity.
- `PagebldrRenderer` renders the Element tree, compiled authored CSS, scope,
  Element, and Class attributes, prepared Resources, and optional CSP nonce.
- Unknown Elements render a visible status in edit mode and are omitted from
  preview/published output.
- `defineBlock()` and `defineTemplate()` register factories for ordinary
  editable Element trees. They introduce no persisted special case.
- Runtime preparation now validates/migrates Documents and resolves Resources
  before returning a Published page.

## Verification performed

- SSR output for every standard Element through its definition.
- Semantic heading, navigation, tablist, media, list, figure, time, rating, and
  disclosure output.
- Child-policy validation, including none, any, allowed types, and limits.
- Unknown Element edit and published behavior.
- Resource reference validation, stable keys, failure on missing adapters, and
  resolution through independent asset and CDN adapters.
- Package source contains no Next.js renderer dependency.
- Complete formatting, lint, TypeScript, tests, build, package analysis,
  packed-consumer, licence, and diff gates are required before commit.

## Deferred work and risks

- Rich interactive behavior for tabs, accordions, countdowns, and counters lands
  with the client/editor composition phases; current published output preserves
  accessible native or static semantics.
- Runtime route normalization, caching, events, and interaction instrumentation
  are Phase 6A.
- React 18 and Vite/Next packed matrices remain part of the later compatibility
  and release phase; current SSR verification runs on the workspace React 19
  target.
- No deployment, publication, push, or external-system change occurred.

## Commit

To be recorded after product-owner review and authorization.
