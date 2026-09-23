# Parity Phase 3 audit — editor controller and isolated canvas

Status: complete and accepted by the product owner on 23 September 2026. The
product owner limited browser verification to visual and interaction checks and
explicitly waived accessibility, console and network testing.

Source baseline: Quizr Page Builder V2 commit
`7dec26465c454b25545664e84d8e1e91b97ae9d1`.

## Outcome

The editor now renders the controlled Document in a package-owned iframe rather
than in the Host browsing context. A private, versioned bridge coordinates the
shell and canvas while keeping Document mutation on the existing command path.
The Project Enquiry Reference Host consumes the built aggregate `pagebldr`
package, so the browser gate verifies what an installed consumer receives.

The canvas owns readiness and error presentation, content sizing, selection and
hover synchronization, geometry reporting, reveal, edit-only hidden content,
navigation suppression, inline editing and pointer placement. Desktop fixed,
Desktop fill, Tablet and Mobile now change the iframe's real layout viewport;
package widget media queries therefore follow the authored viewport rather than
the outer Host window.

## Canvas bridge and controller

- Added a private `pagebldr.canvas` protocol with an explicit version and canvas
  identity. Shell messages cover Document, selection, hover, reveal and inline
  edit start; canvas messages cover ready/error, selection/hover, geometry,
  inline commit, content resize and drop requests.
- Kept bridge listeners stable while current controlled editor behavior is read
  through refs. This prevents mutation or Undo updates from being lost while a
  listener is being replaced after state changes.
- Added authored width calculation for 1280px Desktop fixed, available-width
  Desktop fill, 820px Tablet and 390px Mobile.
- Added zoom clamping and steps across 25–200%, Fit constrained to 100%, and a
  shell-owned scroll-to-selection calculation based on canvas geometry.
- The iframe is a presentation/layout isolation boundary, not a security
  boundary. Package CSS needed by the renderer is copied into its document and
  Host styles do not participate in authored layout.

## Editing behavior

- Canvas and Structure selection remain synchronized in both directions, with
  selected and hovered geometry drawn inside the canvas.
- Heading and Rich Text definitions now own their inline-edit mapping. Double
  click or Enter starts editing; Enter commits and Escape cancels. Commit emits
  `update-props`, participates in Local history, and restores managed markup
  before React receives the next controlled Document.
- Element-library items and movable Structure rows expose package drag types.
  The canvas resolves before/inside/after targets through child policy, locks,
  root rules and cycle prevention before requesting an insert or move command.
- `Alt+ArrowUp/ArrowDown` reorders the selection. `Alt+ArrowRight` nests it in a
  compatible previous sibling and `Alt+ArrowLeft` moves it outward. These paths
  reuse the pointer placement resolver.
- Preview uses the unsaved controlled Document, removes editor side panels and
  canvas chrome, suppresses navigation, and returns through its button or
  Escape.

## Public-interface changes

- Added optional definition-owned `inlineEditing` metadata to
  `ElementDefinition` and exported its type.
- Added the canvas behavior and authored viewport contract to
  `docs/public-interface.md`.
- No canvas protocol, controller, placement resolver, iframe DOM structure or
  internal editor store is exported from the consumer package.

## Visual evidence

Captured through the T3 Code embedded browser against the Vite Reference Host
using the built aggregate package:

- [Fit overview of the complete authored page](evidence/parity-phase-3/editor-fit-overview.png)
- [390px Mobile authored canvas at 100%](evidence/parity-phase-3/mobile-authored-canvas.png)

The recorded interaction pass also covered Preview/Escape, automatic reveal,
inline edit/Undo, keyboard reorder/Undo, drop-target display and Divider
insertion/Undo. The recording remains a local T3 test artifact rather than a
repository asset.

## Verification performed

- Core tests: 54 passing across nine files, including definition-owned Heading
  and Rich Text inline-edit mappings.
- React tests: 23 passing across six files, including every bridge message
  family, invalid version/canvas/payload rejection, zoom/viewport rules, locked
  and circular placement, same-parent index adjustment and keyboard placement.
- Core and React TypeScript checks pass.
- `@pagebldr/react`, the aggregate `pagebldr` package and the Vite Reference
  Host production builds pass.
- `git diff --check` passes; Git only reports the repository's line-ending
  notices.
- T3 visual interaction confirmed a real 390px Mobile iframe with collapsed Menu
  behavior, an 820px Tablet iframe, available-width Desktop fill, 25% Fit,
  selection reveal, inline commit/Undo, validated insertion, keyboard reorder,
  preview chrome removal and Escape return.

## Checks intentionally omitted

At the product owner's direction, no browser accessibility, console or network
testing was run for this gate. The snapshot tool may display historical browser
diagnostics from server restarts; those were not used as gate results.

## Deferred work and risks

- Parity Phase 4 owns final Quizr shell fidelity: the responsive top bar,
  toggleable panels, movable/resizable Structure window, complete Structure
  menus and phone/tablet authoring overlays. The present side panels are still
  the prior scaffold.
- Parity Phase 5 owns the complete Content, Style and Advanced inspector and
  Page design dialog.
- Parity Phase 6 owns Blocks, Templates and media-library authoring.
- Canvas rendering remounts on a new controlled Document to guarantee that
  browser-edited markup is reconciled before history changes. Stateful custom
  widgets should therefore treat Document commands as an authoring reset until a
  narrower reconciliation strategy is proven.
- The source and packed Vite builds retain their existing non-failing chunk-size
  warning.
- The uncompressed React-entry guardrail increased from 625,000 to 650,000 bytes
  against a measured 644,665-byte artifact. Other package, compressed, CSS and
  tree-shaken budgets remain unchanged.

## Commit

The implementation, verification evidence and audit are included in the Phase 3
checkpoint commit created after product-owner acceptance.
