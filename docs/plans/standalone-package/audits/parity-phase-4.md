# Parity Phase 4 audit — editor shell and Structure

Status: complete and accepted by the product owner on 24 September 2026. Browser
verification was limited to visual and interaction checks at the product owner's
direction; accessibility, console and network testing were intentionally
omitted.

Source baseline: Quizr Page Builder V2 commit
`7dec26465c454b25545664e84d8e1e91b97ae9d1`.

## Outcome

The standard editor now presents the package-owned Quizr-style authoring shell
instead of a fixed three-column scaffold. The Reference Host still imports the
built aggregate `pagebldr` package and its compiled stylesheet without Host CSS
or replacement components, so the browser evidence represents the installed
developer experience.

The shell has a compact responsive top bar, contextual Add and Inspector panels,
authored viewport controls, dirty/save presentation, Undo/Redo, Structure,
Preview, Save, Publish and a secondary action menu. Container queries drive
shell choreography independently of the authored canvas breakpoint. At narrow
widths the primary controls move to a 44px bottom toolbar, Add and Inspector
become movable overlays, and canvas zoom becomes one compact menu trigger.

## Structure and editing behavior

- Added a floating Structure window with move, native resize, minimize, close,
  reset and collapse-all behavior.
- Default expansion reveals the Page and first-level containers without flooding
  the window with every descendant. Selection and hover stay synchronized with
  the isolated canvas.
- Tree rows support pointer placement and arrow-key tree navigation. Structural
  shortcuts cover copy, paste, duplicate, delete, indent, outdent, move and
  Undo/Redo while respecting root and lock constraints.
- The row menu provides edit, copy/paste, duplicate, copy/paste styles, rename,
  directional movement, indent/outdent, hide, lock and delete actions. Save as
  Block remains visibly disabled until the Phase 6 Host block source exists.
- Rows expose hidden, locked, responsive-hidden and broken internal-anchor
  indicators. Responsive hiding is derived from authored breakpoint styles;
  broken links are detected from missing anchor Element references.
- Added a `paste` core command that remaps copied subtree IDs and internal
  references before insertion as one reversible Action. Duplicate now refuses
  locked sources and locked parents consistently with the Structure UI.

## Public-interface changes

- Added `paste` to the public `EditorCommand` union and documented its fresh-ID
  subtree semantics.
- No shell store, Structure controller, movable-window state, DOM classes or
  responsive implementation details are public.
- No Host navigation callback was added. Leaving the editor remains Host-owned
  navigation and can be supplied through the existing contribution seam.

## UI source and styling

The editor uses the existing package-owned shadcn primitives and adds the shadcn
Dropdown Menu source for toolbar, Structure and compact zoom menus. Its registry
provenance is recorded in `docs/attributions/ui.md`. ReUI was not available in
this runtime. Portal-safe root tokens ensure menus retain the compiled package
theme outside the editor root.

After the accepted canvas-control correction, the packed React entry is 735,111
bytes and the compiled stylesheet is 64,095 bytes. Their explicit uncompressed
guardrails are 740,000 and 66,000 bytes respectively; compressed, tree-shaken
and other entry budgets remain unchanged.

## Acceptance coverage

- Implemented acceptance cases: `SHELL-02` through `SHELL-04`, `ZOOM-01`,
  `VIEW-01`, `VIEW-02`, `PREVIEW-01` and `STRUCT-01` through `STRUCT-05`.
- `SHELL-01` is implemented except for Exit: package code deliberately does not
  own Host navigation, and the standard contribution seam is the neutral place
  for a Host-provided exit action.
- `STRUCT-03` exposes Save as Block in its expected position but keeps it
  disabled until the `TRACE-LIBRARY`/Phase 6 saved-Block source is available.
- The Phase 4 interaction pass covers the Phase 4 portions of `TRACE-AUTHOR`,
  all of `TRACE-PREVIEW`, and the available shell actions in
  `TRACE-RESPONSIVE-SHELL`. History, Page design and lifecycle actions remain
  assigned to their later phases.
- Visual evidence covers `VIS-01` at desktop and phone, the Phase 4 shell around
  `VIS-04`, and the entry/exit behavior of `VIS-10`. The source comparison is a
  match with approved product-neutral names and page content.
- The Reference Host renders `project-enquiry.document.json`; core validation
  also exercises `all-elements.document.json` and
  `responsive-states.document.json`.

## Visual evidence

Captured through the T3 Code embedded browser against the Vite Reference Host
using the built aggregate package:

- [Desktop default shell](evidence/parity-phase-4/desktop-default.png)
- [Desktop Inspector and Structure](evidence/parity-phase-4/desktop-inspector.png)
- [Desktop secondary actions menu](evidence/parity-phase-4/desktop-more-menu.png)
- [Phone canvas and compact zoom](evidence/parity-phase-4/phone-canvas.png)
- [Phone Structure overlay](evidence/parity-phase-4/phone-structure.png)
- [Phone Add overlay](evidence/parity-phase-4/phone-add-panel.png)
- [Desktop shell interaction recording](evidence/parity-phase-4/desktop-shell-flow.mp4)
- [Desktop action-menu recording](evidence/parity-phase-4/desktop-more-menu-flow.mp4)
- [Phone shell recording](evidence/parity-phase-4/phone-shell-flow.mp4)
- [Desktop width-Fit and viewport indicator](evidence/parity-phase-4/desktop-canvas-controls.png)
- [Desktop canvas-control recording](evidence/parity-phase-4/desktop-canvas-controls-flow.mp4)
- [Transient dimensions pill and Tablet range](evidence/parity-phase-4/desktop-transient-dimensions.png)
- [Transient dimensions interaction recording](evidence/parity-phase-4/desktop-transient-dimensions-flow.mp4)

The T3 snapshot bridge returned `PreviewAutomationExecutionError`, so the still
images were extracted from T3's transferred recordings. Visual inspection
confirmed the rendered desktop and phone layouts, opaque portal menus, movable
Structure/Add surfaces and compact mobile zoom control.

The accepted follow-up pass confirmed that one Desktop icon cycles fixed and
full-width modes, width-Fit remains active across canvas-size changes, and the
percentage activates Fit while manual zoom exits it. The top-right dimensions
pill is absent at rest, appears from the authored viewport or desktop zoom
controls, remains available for a two-second pointer handoff, and hides again
after leaving it. At a 946px full-width canvas, the conditional Tablet control
reported the authored maximum width of 1024px; outside Tablet/Phone ranges no
device control is rendered.

## Verification performed

- All workspace formatting, ESLint and TypeScript checks pass.
- Core tests: 55 passing across nine files, including paste ID remapping and
  locked duplicate refusal.
- React tests: 27 passing across seven files, including Structure expansion,
  tree navigation, responsive-hidden and broken-anchor indicators.
- Runtime, server and adapter tests pass; documentation content and spelling
  checks pass.
- Neutral parity fixtures validate all 24 standard Element types.
- All eleven package, documentation and example builds pass.
- Publint and package export/type checks pass. The packed package passes its
  size, tree-shaking, stylesheet and Vite consumer gates.
- License inventory and `git diff --check` pass.
- T3 visual interaction covered desktop shell panels, Structure manipulation,
  preview/return, secondary actions, narrow canvas/Add/Structure states, and the
  transient dimensions pill's cooldown, handoff and breakpoint tooltip.

## Checks intentionally omitted

At the product owner's direction, no browser accessibility, console or network
testing was run for this gate.

## Deferred work and risks

- Phase 5 owns definition-specific Content controls, complete Style and Advanced
  panels, inherited-value origins, responsive/state editing and Page design.
  Current panel shells intentionally expose the existing controls.
- Phase 6 owns Blocks, Templates, media authoring and the Save as Block action.
- History and Page design entries remain disabled placeholders until their
  owning phases provide the complete experiences.
- The packed Vite consumer retains its existing non-failing chunk-size warning.
- Package shell responsiveness is based on its own container width. The phone
  evidence uses a 390px editor container because the T3 viewport resize call
  timed out; this exercises the same shipping container-query rules.
- Space+drag canvas panning and Alt+wheel zoom are recorded as `ZOOM-02` for the
  Phase 8 canvas interaction pass; they were explicitly deferred by the product
  owner and are not part of this correction.

## Commit

The implementation, verification evidence and this audit are included in the
Phase 4 checkpoint commit created before product-owner review.
