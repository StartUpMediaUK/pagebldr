# Parity Phase 1 audit — engine and schema completion

Status: complete and accepted by the product owner on 22 September 2026. The
product owner narrowed this phase's browser gate to visual confirmation only;
console, network, automated accessibility and manual keyboard audits were
explicitly waived for this gate.

Source baseline: Quizr Page Builder V2 commit
`7dec26465c454b25545664e84d8e1e91b97ae9d1`.

## Outcome

The package core now implements the Quizr-derived Document, command, Local
history and style-engine behavior required by Parity Phase 1. Core remains free
of React, DOM, transport, storage, database and product dependencies. Changes
were characterized through the public `builder.documents`, `builder.editor` and
`builder.styles` seams before implementation.

The Vite Reference Host consumes the schema-v2 responsive fixture through public
exports. Its default editor route has no custom Contributions; extension
examples are lazy-loaded only on `#/extensions`. The packed-package check now
copies, typechecks and builds the actual Reference Host against the freshly
installed tarball.

## Document and schema changes

- Raised the package Document schema from v1 to v2.
- Replaced the old metadata object with bounded search/social SEO,
  default-header intent and existing content-width/breakpoint settings.
- Represented the social image as a neutral `ResourceReference`, keeping Quizr
  asset identity outside the package contract.
- Added a deterministic, input-immutable built-in v1 → v2 migration.
- Added unique lowercase-slug anchor validation.
- Added typed External, Anchor, Email, Telephone and Host application Resource
  Destinations plus definition-owned destination discovery and broken-anchor
  validation.
- Enforced container root, registered property, Element capability, Class and
  Variable-kind applicability invariants.

## Commands and Local history

- Added atomic create-and-assign Class, assigned-Class reorder, Class style
  replacement, style paste and full-Template application commands.
- Added a typed style clipboard selector. Template application is one reversible
  transaction and preserves Document ID, title, slug, root identity and SEO.
- Matched Quizr command labels, including state-dependent lock/visibility
  labels.
- Added non-destructive, clamped Local history jumps.
- Preserved the 100-Action default, inclusive 750ms coalescing boundary,
  branching semantics and undo/redo validation.
- Style resets now remove empty state and breakpoint records, matching the
  source command behavior.

## Style engine

- Replaced the three skeletal groups with the nine Quizr groups: Layout,
  Spacing, Size, Position, Typography, Background, Border, Effects and
  Responsive visibility.
- Corrected the research count from 93 to the pinned source's 91 unique
  properties (92 capability assignments because `display` is shared).
- Added Desktop → Tablet → Mobile and Normal → interaction-state resolution,
  ordered Class/local precedence, and public origin metadata.
- Added equal-specificity authored layers and forced editor selectors for Hover
  and Focus Visible.
- Added deterministic camelCase-to-CSS compilation and stronger unsafe-value
  rejection while retaining safe HTTP(S) background URLs.
- Added typed Variable applicability checks for all six Variable kinds.

## Reference Host and fixture corrections

- Corrected parity fixture style keys from CSS kebab-case to the persisted
  camelCase grammar used by Quizr; kebab-case exists only in compiled CSS.
- Renamed fixture `socialImageAssetId` to neutral `socialImage` Resource intent.
- Seeded `#/editor`, `#/preview`, `#/published` and `#/readonly` with the
  responsive engine probe. The full Project Enquiry seed remains gated on the 24
  typed Element definitions in Parity Phase 2.
- Isolated custom Contributions in a dynamically imported `#/extensions` module.
- Extended packed verification to typecheck and production-build the real
  Reference Host from the installed package artifact.

## Public-interface changes

- Added `Destination` and `parseDestination()`.
- Added `PagebldrStyleClipboard` and `builder.editor.clipboard.copyStyles()`.
- Extended `EditorCommand` with the new Class, style and Template commands.
- Added `builder.editor.history.jump()`.
- Added `builder.styles.resolve()` plus exported resolved-value/source types.
- Runtime prepared metadata now exposes complete search/social SEO fallbacks.
- Updated domain language and public-interface documentation.
- Added a minor Changeset for the published package interface and schema work.

## Acceptance coverage

- `ENGINE-01`: normalized structure, root, anchors, destinations, registered
  properties, capabilities, Classes and Variables are validated.
- `ENGINE-02`: the added mutations are ordinary deterministic commands with
  reversible patches and source-equivalent labels.
- `HISTORY-01`: bounded history, inclusive coalescing, branching, undo/redo and
  jump are covered.
- `CSS-01`: the immutable responsive fixture validates and compiles with
  inheritance, state fallback, origin resolution, forced states and safe output.
- `ANCHOR-01`, `SEO-01`, `DESIGN-01`, `DESIGN-02` and `VARIABLE-01`: their core
  schema and policy portions are covered; their editor surfaces remain in their
  scheduled UI phases.
- `DEST-01`: typed validation is covered; runtime resolution is Parity Phase 2.
- `INSTALL-01`–`INSTALL-03`: packed compilation/build, default-route source
  isolation and T3 visual confirmation are covered.

## Verification performed

- Focused red → green Vitest runs for Documents, Destinations, style resolution,
  CSS compilation, commands, Template application and history.
- `pnpm --filter @pagebldr/core test`: 46 tests passed.
- `pnpm --filter @pagebldr/core typecheck`: passed.
- `pnpm typecheck`: 11 workspaces passed.
- `pnpm lint`: passed.
- `pnpm parity:fixtures:check`: three Documents and 24 target Element types
  passed structural checks.
- Reference Host source-mode typecheck and Vite production build: passed.
- `pnpm packages:check`: Publint and Are the Types Wrong passed; the isolated
  tarball consumer installed successfully; the actual copied Reference Host
  typechecked and built against that tarball.
- React best-practices review: the extension-only module is conditionally
  loaded, hooks have stable primitive dependencies, and no component or
  accessibility issue requiring a change was found.
- `pnpm check`: the first run stopped at formatting for this newly written
  audit; after formatting it, the complete format, lint, typecheck, test,
  fixture, build, package and licence sequence passed.
- T3 embedded-browser visual review: the standard editor, responsive canvas,
  preview/published output, read-only route and isolated extension route were
  opened and visually inspected at the Reference Host development URL.
- Evidence is stored under `audits/evidence/parity-phase-1/`: desktop and
  mobile-canvas screenshots, route screenshots and the two T3 recordings from
  which the stills were captured. The preview snapshot endpoint failed
  repeatedly, so the successful T3 recording endpoint was used for durable
  visual evidence.

## Checks intentionally omitted

At the product owner's direction, no console, network, automated accessibility
or manual keyboard audit was run for this gate. These omissions do not block
Parity Phase 1 acceptance.

## Deferred work and risks

- Parity Phase 2 owns the 24 typed standard Element definitions, definition
  migrations, runtime Destination resolution, approved fonts, Resource/media
  rules and definition-owned interactive widgets.
- Later UI phases expose the completed settings, SEO, anchors, Variables,
  responsive/state controls and history jump in the editor.
- The current Reference Host still renders the skeletal standard definitions;
  its full Project Enquiry fixture cannot be the default until Phase 2.
- The source and packed Vite builds report a non-failing main-chunk size
  warning.
- GitHub/CI matrices were not observed locally. No commit or push was
  authorized.

## Commit

No commit created; repository commits require explicit authorization.
