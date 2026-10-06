# Parity Phase 5 audit — inspectors and Page design

Status: in progress from 24 September 2026.

Source baseline: Quizr Page Builder V2 commit
`7dec26465c454b25545664e84d8e1e91b97ae9d1`.

## Current checkpoint

- Replaced the shallow `{ key, label }` Content-control metadata with a
  definition-owned discriminated contract for text, number, boolean and select
  controls.
- The standard inspector now renders text and bounded numeric inputs, switches,
  and labelled native selects without requiring Host components or CSS.
- Heading owns its semantic level options. Scalar standard-Element defaults own
  typed controls; Resource and ordered-item editors remain explicit Phase 5 work
  and are not guessed from runtime values.
- The custom-Element example compiles against the same public control contract.
- Added the definition-owned Destination control used by Button. It authors
  external, anchor, email, telephone and neutral Host application destinations;
  anchor choices include only Elements with authored anchor IDs.
- The Vite Reference Host supplies application-page choices through the public
  editor prop so the installed package surface exercises that Host seam.
- Advanced now owns authored anchor-ID editing. Input normalizes to an 80
  character lowercase ASCII slug, duplicate drafts remain visible with an inline
  error, and valid changes immediately update Destination choices.
- Image now owns labelled alternative-text, confirmation, decorative, nullable
  Destination, fit and focal-position controls. Its Resource source stays out of
  the generic inspector until the shared Phase 6 media picker is available.
- Menu now owns its breakpoint controls and reusable ordered Links editor. Link
  cards support blur-validated labels, all typed Destination branches, fresh-ID
  add, minimum-safe remove, and explicit up/down reordering. New links prefer
  the first authored anchor and fall back to a neutral external destination.
- Collection controls remain serializable definition metadata: item defaults, ID
  policy, limits, nested controls and dependent-field visibility are all
  described without shipping Element-specific React components.
- List, Icon List, Accordion, Tabs and Social Links now use the same ordered
  collection contract. Nested controls cover text, multiline text and labelled
  selects; fresh defaults validate against each owning Element schema, and
  minimum/maximum policies remain definition-owned.
- Rich Text now owns a structured block-control descriptor rather than falling
  back to scalar inference. Authors can add, remove, reorder, retype and edit
  paragraph, heading, bulleted-list and numbered-list blocks while continuous
  text changes use the existing property coalescing key.
- shadcn Native Select source was reviewed and adapted to the package import and
  full-width inspector layout. The lightweight native primitive keeps the
  aggregate React entry within its then-current 760,000-byte guardrail.
- Style now authors Typography and Background while Advanced authors only the
  selected Element's registered Layout, Spacing, Size, Position, Border, Effects
  and Responsive visibility capabilities. Desktop, Tablet and Mobile controls
  follow the authored canvas viewport; Normal, Hover and Focus Visible share a
  forced edit-canvas preview state.
- Each Style field reports its resolved local/Class, breakpoint, state and
  inherited origin. Applicable typed Variables come from the same engine policy
  used by validation. Every property has a reset action, and reset-all clears
  the Element's local responsive styles through the existing command.
- Page design now stages and validates content width and authored tablet/mobile
  boundaries before applying them as one controlled `update-settings` command.
  Settings records default Host-header intent without rendering Host chrome. SEO
  & social authors the required bounded page title as its own undoable page
  command, the complete bounded metadata copy and `noIndex` contract, and can
  inspect or clear an existing social-image Resource. Selecting a new image
  stays with the shared Phase 6 media picker.
- Variables now supports all six kinds with safe kind-specific defaults and
  validation, unique add/rename, value editing, per-kind reordering, usage
  counts, unused deletion and explicit guarded deletion when declarations use a
  Variable. Changes use the existing public commands immediately and remain in
  Local history; Style continues to filter choices by engine applicability.
- The current shadcn Alert Dialog registry source was reviewed and adapted to
  package imports for the destructive used-Variable confirmation. ReUI was not
  available in this runtime.
- Element-specific visual controls are now serializable definition metadata,
  rendered before the ordinary responsive Style capabilities. Logo conditionally
  exposes image width, fit, position, gap and alignment; Menu exposes alignment,
  item treatment, spacing and open-panel treatment; Gallery layout is a labelled
  segmented Square/Masonry/Carousel choice instead of an invalid free-text
  Content field. Custom Elements use the same public `styleControls` contract.
- Scalar Content and responsive Style inputs now retain command-rejected drafts
  with associated accessible errors. Escape discards a rejected draft; external
  controlled updates and Undo replace stale drafts. Empty/non-finite numbers and
  definition-declared bounds are validated before dispatch. Valid edits keep the
  existing per-property 750ms history coalescing policy. Locked Elements disable
  all Content control variants.
- Command validation now rejects unsafe CSS in local styles, Classes and
  Variables before a history entry can be created, using the compilation policy.
  A new rejection test exposed the previous compile-only validation gap.
- The packed checker has an opt-in retained Reference Host mode and a built
  `/packed-artifact.json` audit surface, without changes to default editor
  wiring.

## Evidence

- [Typed Content controls](evidence/parity-phase-5/typed-content-controls.png)
- [Definition-owned Heading level](evidence/parity-phase-5/typed-heading-control.png)
- [Typed Content-control flow](evidence/parity-phase-5/typed-content-controls-flow.mp4)
- [Typed Destination flow](evidence/parity-phase-5/typed-destinations-flow.mp4)
- [Anchor authoring flow](evidence/parity-phase-5/anchor-authoring-flow.mp4)
- [Image Content flow](evidence/parity-phase-5/image-content-flow.mp4)
- [Structured Rich Text controls](evidence/parity-phase-5/structured-rich-text-controls.png)
- [Structured Rich Text flow](evidence/parity-phase-5/structured-rich-text-flow.mp4)
- [Responsive Style controls](evidence/parity-phase-5/style-responsive-state-controls.png)
- [Advanced capability controls](evidence/parity-phase-5/advanced-capability-controls.png)
- [Responsive Style flow](evidence/parity-phase-5/style-responsive-state-flow.mp4)
- [Page design controls](evidence/parity-phase-5/page-design-controls.png)
- [Page SEO and social controls](evidence/parity-phase-5/page-design-seo-controls.png)
- [Page design flow](evidence/parity-phase-5/page-design-flow.mp4)
- [Variable manager](evidence/parity-phase-5/variable-manager.png)
- [Edited and reordered Variable](evidence/parity-phase-5/variable-manager-updated.png)
- [Used-Variable deletion guard](evidence/parity-phase-5/variable-delete-guard.png)
- [Variable manager flow](evidence/parity-phase-5/variable-manager-flow.mp4)
- [Menu-specific Style controls](evidence/parity-phase-5/element-style-menu.png)
- [Menu-specific Style flow](evidence/parity-phase-5/element-style-menu-flow.mp4)
- [Gallery layout controls](evidence/parity-phase-5/element-style-gallery.png)
- [Gallery layout flow](evidence/parity-phase-5/element-style-gallery-flow.mp4)
- [Conditional Logo treatment controls](evidence/parity-phase-5/element-style-logo.png)

The T3 embedded browser confirmed that changing Heading Level from 1 to 2
updates the isolated canvas from `H1` to `H2`, and that Copyright's boolean
properties render as labelled switches.

The T3 embedded browser also exercised Button destination switching across
External URL, Anchor, Email and Application page. Anchor choices contained only
the four addressable Elements in the Reference Document. The Host supplied
Welcome and Pricing application choices, and editor Preview resolved Welcome to
`#/preview/welcome`. The still-snapshot endpoint failed during this checkpoint;
the linked T3 recording is the visual evidence.

The anchor-authoring recording shows a valid value normalize from `About Us` to
`about-us` without leaving Advanced, followed by a duplicate `FAQ` draft that
stays visible with its inline error while the canvas retains the last valid ID.
This check also caught and corrected an Inspector component-identity regression
before the checkpoint was committed.

The T3 embedded browser subsequently exercised the ordered Menu through the Vite
Reference Host. It confirmed dependent collapse fields hide for `No breakpoint`
and return for Tablet, a blurred label edit updates the isolated canvas,
down-arrow reordering updates both inspector and canvas order, and a new fifth
link receives a fresh ID and the first authored anchor. Its nested Destination
control also switched to the Host-supplied application choices Welcome and
Pricing. The screenshot endpoint then timed out and detached the preview host
before the recording could be transferred, so this pass has verified state
observations but no new evidence artifact; no alternative browser system was
used.

After the T3 preview was restarted, the embedded browser exercised Structured
Rich Text through the Vite Reference Host. It replaced the first block's text,
focused and activated Add block with the keyboard, changed the new block to a
Heading with the keyboard, and moved it above the paragraph with the keyboard.
The inspector and isolated canvas both retained the resulting heading-first
order. The linked screenshot and recording are the visual evidence.

The T3 embedded browser then exercised a selected Container's Style and Advanced
surfaces. Keyboard activation changed the authored viewport to Tablet, forced
Hover on the isolated canvas, applied an applicable color Variable to a
Tablet/Hover declaration, and reset that declaration. The origin display changed
from local to inherited after reset. The browser also confirmed that Advanced
exposes the registered structural capability groups rather than the former
placeholder.

The same built Reference Host exercised Page design end to end. It confirmed an
out-of-range content width produces an inline error and disables Apply, then
saved a valid 1100px width, toggled the Host-header intent, and authored social
copy using keyboard activation. Reopening the dialog retained the applied
values. The linked stills and recording show the Design and SEO & social states.

The rebuilt aggregate package then exercised Variables in the same Host. It
added a Colour Variable, edited its value, reordered it with Space from the
keyboard, and immediately deleted it while unused. Existing fixture usage counts
matched the researched baseline. Deleting used Deep olive opened the titled
destructive alert with the five-source consequence and keyboard-focused Cancel.
The SEO tab also retained an invalid blank page-title draft with an inline error
and disabled Apply, then committed a valid title on blur to both dialog and Host
toolbar. The linked stills and short replacement recording are the visual
evidence; an earlier recording crossed an overnight pause and exceeded T3's
transfer limit, so it was discarded rather than cited.

The next built-package pass selected the seeded Menu and confirmed that its
definition-owned segmented alignment and item-appearance controls update through
ordinary commands; choosing Background revealed the dependent colour fields. It
then inserted the standard Gallery through the package library and changed
Square to Masonry and Carousel, with each choice immediately changing the
isolated canvas layout. Finally, switching the seeded text Logo to
image-and-text revealed only the applicable width, fit, position, gap and
alignment controls. The linked stills and recordings show these definition-owned
Style surfaces.

## Verification

- `pnpm check` passed: formatting, lint, type checking, all package tests,
  parity fixtures, all 11 builds, docs checks, public-export checks, packed
  consumer tests, size budgets and license inventory.
- Core: 58 tests passed across 10 files. React: 35 tests passed across 10 files.
  Runtime, server and adapter suites also passed.
- The packed aggregate React entry is 739,918 bytes and the compiled stylesheet
  is 64,555 bytes, within the current 740,000-byte and 66,000-byte guardrails.
- The Destination control and editor-Preview application resolver bring the
  React entry to 751,943 bytes and the stylesheet to 65,314 bytes. The React
  guardrail was deliberately rebased to 760,000 bytes for this new package-owned
  capability; the stylesheet remains within its 66,000-byte guardrail.
- Anchor authoring brings the React entry to 755,039 bytes; the stylesheet is
  unchanged at 65,314 bytes and both remain inside those guardrails.
- Definition-owned Image controls bring the React entry to 756,175 bytes; the
  stylesheet remains unchanged and both budgets continue to pass.
- Reusable ordered-item controls bring the React entry to 765,372 bytes and the
  stylesheet to 65,349 bytes. The React guardrail was narrowly rebased to
  770,000 bytes and the packed-archive guardrail to 1,265,000 bytes for this
  package-owned capability; the 66,000-byte stylesheet guardrail is unchanged.
- The remaining non-media ordered Content editors bring the React entry to
  771,693 bytes and the packed archive to 1,265,684 bytes. Their guardrails were
  narrowly rebased to 776,000 and 1,270,000 bytes respectively; the stylesheet
  remains 65,349 bytes with its 66,000-byte guardrail unchanged. The expanded
  serializable contract brings the tree-shaken core consumer to 120,087 bytes,
  with that guardrail narrowly rebased from 120,000 to 121,000 bytes.
- Structured Rich Text brings the React entry to 777,033 bytes; its guardrail
  was narrowly rebased from 776,000 to 782,000 bytes. The packed archive,
  tree-shaken core consumer and stylesheet remain inside their existing
  guardrails.
- Source-mode browser interaction confirmed List selection through Structure,
  the numbered-list switch, ordered item cards and fresh-item insertion. The T3
  preview host detached before a transferable screenshot or the remaining
  Element variants could be captured, so this is not counted as packed-browser
  visual evidence.
- The restarted T3 preview completed the Rich Text browser and keyboard
  checkpoint. Keyboard activation added a block, changed its native select to
  Heading and moved it upward; the isolated canvas rendered the edited text and
  heading-first order. No substitute browser system was used.
- The T3 embedded browser exercised the built aggregate package through the Vite
  Reference Host and supplied the linked visual evidence.
- Core has 59 passing tests across 10 files and React has 39 across 11 files
  after adding typed Variable applicability, Style-section partitioning, origin
  presentation, and edit-only forced-state coverage. Both focused TypeScript
  checks pass.
- Responsive/stateful Style controls bring the aggregate React entry to 784,786
  bytes and the packed archive to 1,278,079 bytes. Their guardrails were
  narrowly rebased from 782,000 to 790,000 bytes and from 1,270,000 to 1,285,000
  bytes respectively. The stylesheet remains 65,349 bytes within its unchanged
  66,000-byte guardrail.
- Page design validation adds two focused cases; React has 41 passing tests
  across 12 files and its focused TypeScript check passes. The complete
  repository gate also passes after the narrow size-budget update below.
- Page design brings the aggregate React entry to 813,599 bytes and the packed
  archive to 1,295,788 bytes. Their guardrails were narrowly rebased from
  790,000 to 820,000 bytes and from 1,285,000 to 1,302,000 bytes respectively.
  The stylesheet remains 65,349 bytes within its unchanged 66,000-byte
  guardrail.
- Variable management adds four focused cases (including page-title bounds,
  six-kind defaults and validation, unsafe values, and per-source usage counts);
  React has 45 passing tests across 13 files and its focused TypeScript and lint
  checks pass.
- Variable management brings the aggregate React entry to 842,466 bytes, the
  stylesheet to 67,558 bytes, and the packed archive to 1,311,664 bytes. Their
  guardrails were narrowly rebased from 820,000 to 850,000 bytes, from 66,000 to
  68,000 bytes, and from 1,302,000 to 1,318,000 bytes respectively.
- Element-specific Style metadata adds one focused core case and three focused
  React visibility cases. Core has 60 passing tests across 10 files and React
  has 48 passing tests across 14 files; focused type checking and lint pass.
- The initial Element-specific Style checkpoint brought the aggregate React
  entry to 848,814 bytes, the stylesheet to 67,645 bytes and the packed archive
  to 1,324,545 bytes. The archive guardrail was narrowly rebased from 1,318,000
  to 1,331,000 bytes. Serializable Style metadata brings the tree-shaken core
  consumer to 123,126 bytes, with its guardrail narrowly rebased from 121,000 to
  125,000 bytes, and the aggregate core entry to 244,274 bytes, with its
  guardrail rebased from 240,000 to 248,000 bytes. The existing 850,000-byte
  React and 68,000-byte stylesheet guardrails remain unchanged.
- The final conditional-visibility refinement passes the complete `pnpm check`
  gate. Its aggregate React entry is 849,195 bytes and core entry is 244,499
  bytes; CSS remains 67,645 bytes. Archive and tree-shaken consumer budgets pass
  in that gate (the exact measurements above precede this refinement).

## Remaining phase gate

Broader validation presentation; phone and packed-browser visual assertions; and
the full Phase 5 verification matrix remain open. Social-image selection, the
shared media picker and other Resource selection stay assigned to Parity
Phase 6.

## 5 October 2026 validation checkpoint

- Core: 61 passing tests across 10 files; React: 51 across 15 files. New
  coverage checks numeric bounds, schema error presentation, rejected Style
  history, successful correction/coalescing, and unsafe local/Class/Variable
  commands.
- The isolated packed consumer gate passes with React 19.2.8. Measurements:
  React entry 851,815 bytes; core 244,756 bytes; CSS 67,645 bytes; archive
  1,328,317 bytes; tree-shaken core consumer 123,329 bytes. Only the React
  guardrail changed, from 850,000 to 856,000 bytes for validation presentation.
- Package `pagebldr@0.0.0-alpha.0`, archive `pagebldr-0.0.0-alpha.0.tgz`;
  SHA-256 `109cc01879893b607224fba84daa0a82adfa8d9d63222aebce14ab58ee337e5b`.
  The built isolated Reference Host was started at `http://localhost:5173`.
- T3 `preview_open` attached `tab_2`, navigation loaded the packed editor and an
  evaluation returned its page title. Snapshot failed twice; after reattachment
  the resize call timed out and the tools reported no connected automation host.
  No screenshot, keyboard result or automated accessibility pass is claimed for
  this checkpoint. Browser acceptance remains open; no substitute browser ran.
- An initial full repository run passed tests/builds but its export check raced
  against the concurrent packing prepack rebuild. Verification was rerun
  serially.
- The serial `pnpm check` passed formatting, lint, all workspace TypeScript and
  tests, immutable parity fixtures, all 11 builds, docs checks, export checks,
  packed consumers, size budgets and licenses. `git diff --check` also passed.
  The generated Next.js type-import churn was restored before commit.
- This checkpoint does not close Phase 5. Broader collection/rich-text
  validation feedback, required desktop/phone visual comparisons, keyboard/a11y
  review and the acceptance matrix remain outstanding. Phase 6 has not begun.

## 5 October 2026 packed Chromium acceptance and Menu gap audit

The product owner authorized Playwright/Chromium as a fallback. T3 status and
snapshot initially succeeded, but focused evaluation failed again. The fallback
used Playwright 1.63.0, Chromium 147.0.7727.15 and axe-core 4.13.0, against the
same isolated packed artifact and SHA-256 recorded above. Desktop was 1440 ×
900; phone was 390 × 844. No Host styling repairs, Contributions or
package-source aliases were added. No package behavior was changed during this
testing pass.

The repeatable browser suite is
[`scripts/check-parity-phase5-browser.mjs`](../../../../scripts/check-parity-phase5-browser.mjs).
Install `playwright` and `@axe-core/playwright` only in the retained isolated
consumer, then run the script from the repository root with that consumer path
and a Chromium executable path. It deliberately exits nonzero while any
acceptance assertion fails; it is not added to the normal repository gate yet.

- [Machine-readable results](evidence/parity-phase-5/browser-2026-10-05/results.json):
  **11 of 31 checks pass; 20 fail**. These counts include separate accessibility
  checks, not 20 distinct product defects.
- [Action trace](evidence/parity-phase-5/browser-2026-10-05/phase5-browser-trace.zip).
  Screenshots are retained separately. The earlier 65 MB full-DOM trace remains
  recoverable in the isolated consumer as `phase5-full-dom-trace.zip`; it was
  moved out of repository evidence to avoid committing redundant frame data.
- [Rejected numeric draft](evidence/parity-phase-5/browser-2026-10-05/menu-invalid-draft-desktop.png),
  [configured Menu controls](evidence/parity-phase-5/browser-2026-10-05/menu-style-configured-desktop.png),
  [actual fullscreen result](evidence/parity-phase-5/browser-2026-10-05/menu-fullscreen-actual-phone.png).
- Heading Content:
  [desktop](evidence/parity-phase-5/browser-2026-10-05/heading-content-desktop.png)
  and
  [phone](evidence/parity-phase-5/browser-2026-10-05/heading-content-phone.png).
- Container Advanced:
  [desktop](evidence/parity-phase-5/browser-2026-10-05/container-advanced-desktop.png)
  and
  [phone](evidence/parity-phase-5/browser-2026-10-05/container-advanced-phone.png).
- [Container Tablet/Hover](evidence/parity-phase-5/browser-2026-10-05/container-style-tablet-hover-desktop.png).
- Variables:
  [desktop](evidence/parity-phase-5/browser-2026-10-05/page-variables-desktop.png)
  and
  [phone](evidence/parity-phase-5/browser-2026-10-05/page-variables-phone.png).

Passing behavior: rejected numeric text remains associated with its error;
keyboard Escape restores the last valid value; unsafe Style text is rejected and
discarded with Escape; Menu edits reach controlled Host state and Save; Heading
level changes update the isolated canvas to H2 at both viewports; Container
padding edits and keyboard Enter-to-add Variables work at both viewports;
Tablet/Hover styling reaches the forced canvas state and resets. These are
interaction checks, not a claim of complete keyboard-only acceptance or visual
fidelity to the source screenshots.

### Menu defects: not intentionally deferred

The first minimized check failed deterministically: Centre was selected, but the
canvas list computed `justify-content: normal`, not `center`. The second
computed 12px item spacing after authoring 40px. Save confirmed both authored
values are in Host state, ruling out failed command dispatch or lost Host
updates as the explanation.

Source inspection then confirmed the main cause: `renderMenu` uses only a subset
of its schema, applies gap to the outer navigation rather than its list, and
does not emit alignment/appearance/position metadata. Compiled base CSS has
ordinary list-collapse rules, not dropdown/fullscreen panel behavior. Runtime
interactions only toggle `data-open` and `aria-expanded`; they omit the source
Menu's close/focus/scroll lifecycle.

| Required Menu behavior                         | Observed packed result                                                         | Phase ownership                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| Horizontal alignment and authored item gap     | Centre has no effect; 40px still renders 12px list spacing.                    | Phase 5 controls; Phase 2 rendering reopened. |
| Item background and hover treatment            | Both computed backgrounds remain transparent after authoring explicit colours. | Phase 5 / Phase 2 rendering.                  |
| Fullscreen presentation and vertical alignment | Open list remains static in the header; vertical alignment metadata is absent. | Phase 2 widget; blocks Phase 5 parity.        |
| Collapsed breakpoint positioning               | Authored position is not emitted or applied by the renderer.                   | Phase 5 / Phase 2 rendering.                  |
| Toggle-to-panel association                    | No `aria-controls` identifies the panel.                                       | Phase 2 widget accessibility.                 |
| Escape and outside-pointer dismissal           | Menu remains expanded.                                                         | Phase 2 widget; blocks current keyboard gate. |
| Fullscreen background scroll lock              | Body overflow remains visible.                                                 | Phase 2 widget.                               |

Pinned source inspection also identifies outstanding UI fidelity: Menu
breakpoints use icon segments rather than the current native select; spacing
uses a slider; colours use picker compositions rather than plain text inputs;
fullscreen horizontal alignment changes its label. The source widget also
includes full-width dropdown header-boundary positioning, fullscreen Logo
treatment, initial focus/focus wrapping and link-selection dismissal. These last
widget behaviors have not all received independent browser assertions in this
pass; they must be added to the follow-up acceptance suite rather than silently
assumed complete.

These are not Phase 6 library/media additions. Controls remain Phase 5 work;
previously accepted Phase 2 runtime coverage must be reopened where these tests
contradict it. Phase 8's cross-product visual/accessibility hardening is not
permission to waive this phase's own interaction and accessibility gate.

### Accessibility and diagnostics

All nine revealed-state axe checks fail. The retained `*-axe.json` files report
WCAG A/AA violations: unnamed disabled leaf-placeholder buttons in Structure and
contrast failures in inspector tabs, Variable usage copy and fixture content.
The leaf buttons are confirmed by their captured DOM; this is not a
missing-label claim about the new scalar inputs. Reports include the specific
targets, not just aggregate counts.

The final run records no page exceptions and no failed transport requests. One
browser console entry reports an HTTP 404; its URL was not supplied by the
console event and was not captured by the response listener, so it remains an
unattributed diagnostic rather than a claimed clean console.

Proportional repository verification for this test/documentation-only change:
Core 61/61 tests, React 51/51 tests, repository formatting and lint, and
`git diff --check` pass. The browser suite intentionally fails on the recorded
defects. TypeScript, builds and package gates were not repeated in this pass;
they passed for the unchanged package code in the preceding validation
checkpoint. No runtime fix or release action is included in this audit commit.

Phase 5 remains **incomplete**. The new screenshots cover the requested named
states, but the Menu comparison is a fail and the broader source-visual,
keyboard-only, collection validation and accessibility gate remains open.

## 5 October 2026 Menu runtime correction

The saved-props regression was reproduced at the public renderer seam before
implementation: SSR lacked the disclosure's `aria-controls` and panel identity.
The preceding packed Chromium run had already shown that commands and Host Save
preserved the values, ruling out controlled-state loss. The renderer, static CSS
and minimal click handler were the cause. The diagnosing-bugs skill's red/green
loop guided this correction; no temporary instrumentation was added.

### Implemented behavior and interface

- Definition-owned Menu markup now renders item alignment, fullscreen vertical
  alignment, breakpoint positioning, item appearance, panel padding/background,
  item gap and item normal/hover backgrounds.
- Dropdown panels position beneath the nearest semantic header/container and
  update on resize/scroll. Fullscreen panels fill the viewport, retain a close
  disclosure and arrange their links according to the saved alignment.
- Client Menu controllers own Escape/outside-pointer/link dismissal, initial
  focus, fullscreen Tab wrapping, focus restoration and reference-counted body
  scroll locking with cleanup on closure/removal. Editor navigation remains
  suppressed. Published anchor navigation respects reduced motion and focuses
  the target.
- Fullscreen navigation clones the nearest Logo without duplicate IDs or Element
  markers. Text paint is preserved from the original computed styles because
  removing Element identity would otherwise lose its local authored styles;
  layout is not frozen to the original header dimensions.
- The optional `ElementRenderContext.elementId` is supplied by the React
  renderer for stable descendant IDs independent of editable anchors. Existing
  callers can omit it. No Document schema change is required.
- Responsive Menu CSS is SSR-generated with Document-scoped selectors, the
  Document's actual tablet/mobile boundaries and the renderer's style nonce.
  Static 1024/767px widget assumptions were removed. Renderer paths remain
  presentation-only and SSR-safe; browser behavior stays in the client module.

### Acceptance scope and remaining work

The expanded packed-browser loop verifies alignment/gap/appearance propagation,
fullscreen layout, panel identity, cloned-logo styling, initial focus, two-way
keyboard wrapping, Escape/outside dismissal, scroll cleanup, dropdown boundary
positioning, anchor selection and transition back to inline navigation above the
collapse breakpoint. Historical red evidence under `browser-2026-10-05` remains
unchanged. New evidence is captured under
[`menu-correction-2026-10-05`](evidence/parity-phase-5/menu-correction-2026-10-05/).

This does not complete Phase 5. Menu breakpoint icon segments, source-equivalent
slider/color-picker composition and dynamic alignment labels remain inspector
work in this phase, not Phase 6. Collection validation and the broader keyboard
and source-visual matrix remain open. The fixture's authored contrast failures
and unnamed Structure leaf placeholders must still be corrected and verified; no
accessibility rule has been disabled to obtain a green result. ReUI was
unavailable; no registry component or Host presentation repair was introduced.

### Verification and retained evidence

Packed artifact: `pagebldr@0.0.0-alpha.0`, SHA-256
`1f3ba149ad6093c90cdf008d5c7a154fb0caf42e1c16cfe0f53971ccc82a9ff0`, React
19.2.8, Chromium 147.0.7727.15. The Reference Host ran its installed, immutable
build with no Host presentation changes. Browser-only dependencies were
installed in the isolated temporary consumer, not this workspace.

- [Results and diagnostics](evidence/parity-phase-5/menu-correction-2026-10-05/results.json):
  **29/38 pass**. All 29 functional checks pass; the nine revealed-state axe
  checks still fail on contrast and/or unnamed Structure placeholders. The open
  fullscreen report now has 14 contrast failures rather than the intermediate
  run's 15; preserving the Logo's authored text color removed the clone-specific
  failure. These remaining failures are not a waived phase gate.
- [Fullscreen phone screenshot](evidence/parity-phase-5/menu-correction-2026-10-05/menu-fullscreen-actual-phone.png)
  and
  [dropdown tablet screenshot](evidence/parity-phase-5/menu-correction-2026-10-05/menu-dropdown-tablet.png)
  were visually inspected. Desktop/phone authoring screenshots and raw axe JSON
  are retained in the same directory, with an
  [action trace](evidence/parity-phase-5/menu-correction-2026-10-05/phase5-browser-trace.zip).
- T3 status, navigation and simple evaluation worked, but snapshot failed twice,
  including after reopening the tab. The user-authorized Playwright/Chromium
  fallback provided the reproducible acceptance loop. No page exceptions or
  failed transport requests occurred. One unattributed console 404 remains in
  diagnostics; the HTTP response listener did not capture its URL.
- `pnpm check` passes: formatting, lint, all-workspace TypeScript/tests, fixture
  checks, builds including Next.js/docs, export checks, packed consumer, size
  guardrails and license inventory. Core tests: 61/61; React: 53/53. Generated
  browser JSON was formatted after capture, and repository formatting, lint and
  `git diff --check` were rerun for the final documentation/harness changes.
  Next.js's generated `next-env.d.ts` change was restored.
- The original public-renderer regression was red before implementation and is
  now green; a second SSR regression covers anchor-independent panel identity
  and style nonce propagation. The Logo color browser assertion also failed
  before the computed-text-style correction and passed after it.
- Measured sizes: React entry 865,904 bytes; core 246,492 bytes; stylesheet
  68,728 bytes; archive 1,348,028 bytes; tree-shaken core consumer 124,327
  bytes. Menu markup/layout/controller narrowly rebase React's guardrail from
  856,000 to 870,000 bytes, CSS from 68,000 to 69,500, and archive from
  1,331,000 to 1,355,000. Core and tree-shaken consumer budgets are unchanged.

This checkpoint does not claim a complete manual keyboard/screen-reader review,
React 18 packed acceptance, Next.js browser acceptance, or a complete source
visual comparison. Those checks were not run here. Phase 5 remains incomplete
and Phase 6 has not begun.

## 5 October 2026 editor accessibility correction

The retained browser loop reproduced the unnamed Structure buttons and inactive
tab contrast failures before implementation. A public `PagebldrEditor` SSR test
using the all-Elements fixture also failed on empty disabled leaf buttons before
the fix and now passes. Structure leaves now use `aria-hidden` noninteractive
spacing; parents retain their labelled disclosure controls and keyboard arrow
behavior.

Inactive shadcn Tabs now use the semantic muted-foreground token rather than a
60%-opacity foreground. The default token is darkened from `#71717a` to
`#62626b` so it remains readable on muted surfaces while retaining a distinct
secondary-text hierarchy. Existing package-owned primitives were reused; no new
dependency, registry source, Host override or public interface was introduced.
The shadcn skill guided token-based styling after consulting current
[Button](https://ui.shadcn.com/docs/components/radix/button) and
[Tabs](https://ui.shadcn.com/docs/components/radix/tabs) documentation. ReUI
remains unavailable. The diagnosing-bugs skill guided the red/green regressions.

The browser harness now reports editor-UI accessibility separately from the
authored page in the iframe, while still running and retaining the full-page
checks. The additional scoped checks exclude only the iframe; no axe rule is
disabled and the full-page suite still returns a failing exit status when
authored content fails. Original screenshots and failure reports remain intact.

Two corrections to the preceding audit's interpretation:

- The Variables report's five failures were inactive tab text, not Variable
  usage-count copy. Its full-page check passes after the tab correction.
- The retained Menu correction JSON contains two no-op command page exceptions,
  contrary to the earlier prose claiming none. Reselecting native options for
  already-current Menu values reproduced these errors. The scalar inspector now
  skips `Object.is`-equal values before dispatch, preserving core's no-op
  rejection contract. A browser assertion failed against the previous artifact
  before this guard was added.

Authored fixture colors have not been silently changed to improve the score. The
remaining full-page failures concern 14 content nodes using the fixture's accent
colors or muted copy on its cream background. These require an explicit
source-parity/accessibility decision and remain phase-gate failures.

### Final verification

Installed artifact: `pagebldr@0.0.0-alpha.0`, React 19.2.8, SHA-256
`eca598c2a80c3636619c67b6922b35bd2d48af7f3750d55086ac81925ef6cb06`. Chromium
147.0.7727.15 exercised desktop 1440×900, tablet 820×1000 and phone 390×844. The
same packed public Reference Host and its immutable build were used, without
Host presentation changes.

- [Results](evidence/parity-phase-5/editor-a11y-2026-10-05/results.json):
  **41/48 checks pass**. All 31 functional assertions, all eight editor-UI
  accessibility checks and both full-page Variables-dialog checks pass. The
  remaining seven full-page checks fail only on authored-content contrast. Their
  raw reports remain alongside the eight `*-editor-axe.json` reports.
- [Desktop Menu/Structure](evidence/parity-phase-5/editor-a11y-2026-10-05/menu-style-configured-desktop.png)
  and
  [phone Variables](evidence/parity-phase-5/editor-a11y-2026-10-05/page-variables-phone.png)
  screenshots were inspected, and the
  [action trace](evidence/parity-phase-5/editor-a11y-2026-10-05/phase5-browser-trace.zip)
  retains the keyboard parent expansion/collapse and scalar-option regression.
- Final diagnostics contain no page exceptions and no failed transport requests.
  The unattributed console 404 remains. T3 status/open/navigation worked, but
  its snapshot again failed; the authorized Chromium fallback was used. An
  intermediate isolated npm install reported a locked temporary Vite cleanup
  warning; the final installation was completed before starting its preview and
  had no such warning.
- `pnpm check` passes: formatting, lint, all-workspace types/tests, fixture
  checks, builds including Next.js/docs, export checks, packed consumers, size
  guardrails and licenses. After the late scalar guard, React TypeScript, 54/54
  tests, build and the packed-consumer gate were rerun; final lint, formatting
  and `git diff --check` cover the guard, harness and documentation. Core
  remains 61/61. Generated Next.js environment imports were restored.
- Final sizes: React 865,978 bytes; core 246,492; CSS 68,571; packed archive
  1,348,048; tree-shaken core consumer 124,327. No budget was raised in this
  checkpoint.

No complete manual screen-reader/keyboard review, React 18 packed browser run,
Next.js browser run or full source-visual comparison was performed here. Phase 5
remains open for richer inspector controls, collection validation, the
authored-content contrast decision and the broader visual/keyboard gate. Phase 6
has not begun.

## 5 October 2026 source palette decision and inspector fidelity

The product owner's instruction, "just leave the source color palette.
continue", resolves the previous checkpoint's authored-color decision: retain
the pinned source palette in the acceptance fixture. No authored palette values
were changed. The existing 14 authored-content contrast failures remain visible
in full-page axe reports, with no disabled rules. This is an explicit
source-parity decision, not a claim that the authored page meets WCAG contrast.
It does not waive accessibility requirements for package-owned editor UI or
future regressions outside these fixture colors.

This checkpoint advances `CONTENT-01`, `CONTENT-02`, `STYLE-01`, `A11Y-01`,
`A11Y-02` and locked-control policy; it does not close the entire Phase 5 gate.

### Implementation and public interface

- Menu Content now has the pinned source's four named icon breakpoint choices.
  Horizontal and fullscreen vertical alignment use icon groups. The horizontal
  label changes to "Horizontal alignment" only for a collapsible fullscreen
  Menu. Space between uses the source's 0–96 slider and displayed px value.
- Definitions own these presentations through optional serializable `labelWhen`,
  semantic select presentations, and bounded number
  `presentation: "slider"`/`unit` metadata. Core has no React, DOM or icon
  dependency. Unknown semantic option values retain their text labels; numbers
  without both bounds retain their numeric input. Existing consumers need no
  changes, and no Document schema/migration change is needed.
- Collection text and textarea controls retain rejected drafts with associated
  Field errors. Required empty labels and schema-rejected overlong values do not
  dispatch accepted mutations or silently revert. Blur remains the commit
  boundary, with Enter as a single-line keyboard alternative and Escape to
  discard. Structured Rich Text uses the same draft/error behavior while
  retaining its existing continuous commit behavior. Undo and controlled value
  replacements clear stale drafts. Equal collection/select and Rich Text values
  avoid core's no-op command rejection.
- Controls still dispatch `update-props` through the controlled editor, using
  `prop:<elementId>:<property>` coalescing; collection items and Rich Text
  blocks share their parent property's history grouping. Slider keyboard changes
  are proved to undo as one Action. Locked definitions disable the controls.
- The shadcn skill guided reuse of Field/Input/Textarea/Toggle Group and
  addition of the official registry Slider after consulting current
  [Slider](https://ui.shadcn.com/docs/components/radix/slider),
  [Field](https://ui.shadcn.com/docs/components/radix/field),
  [Input](https://ui.shadcn.com/docs/components/radix/input) and
  [Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group)
  documentation. Registry source was reviewed and adapted to existing imports,
  semantic tokens, reduced motion and accessible thumb naming. Its unnecessary
  new `cn` dependency was removed in favor of the existing package utility;
  dependency manifests and the lockfile are unchanged. Provenance is recorded in
  `docs/attributions/ui.md`. ReUI remains unavailable.

### Verification

The first iteration passed all functional checks but did not yet scan revealed
error states; the final harness adds those states and locked/slider keyboard
coverage. The first full gate caught the intentionally changed Menu descriptor
snapshot; it was updated to assert `presentation: "viewport"`. An earlier gate
also caught unformatted newly generated browser JSON, which was formatted before
the successful rerun. These were test/gate corrections, not suppressed checks.

Final installed artifact: `pagebldr@0.0.0-alpha.0`, React 19.2.8, SHA-256
`a33afcb0af5fd40c75e27fee78d7a49f19027192fd92313bf3f56fb3e5229718`. Chromium
147.0.7727.15 used desktop 1440×900, tablet 820×1000 and phone 390×844. The
immutable packed Reference Host still imports public exports and compiled
package styles without any Host presentation repair.

- [Final results](evidence/parity-phase-5/inspector-controls-2026-10-05/results.json):
  **68/87 checks pass**: all 46 functional assertions, all 20 editor-UI axe
  checks (including revealed collection/Rich Text errors), and two full-page
  Variables dialog checks. The remaining 19 full-page scans report only the
  unchanged 14 authored contrast nodes. The browser command deliberately returns
  exit status 1; the owner-approved palette decision is documented here, not
  converted into a hidden passing assertion.
- The
  [action trace](evidence/parity-phase-5/inspector-controls-2026-10-05/phase5-browser-trace.zip)
  retains keyboard slider bounds, coalesced undo/redo, breakpoint selection,
  collection Enter/blur errors, Rich Text schema rejection/Escape, locked
  controls and the existing runtime flows. Invalid edits leave rendered content
  unchanged; corrected edits reach the canvas and undo restores the source.
- Inspected screenshots include
  [desktop Menu Style](evidence/parity-phase-5/inspector-controls-2026-10-05/menu-style-configured-desktop.png),
  [tablet slider focus](evidence/parity-phase-5/inspector-controls-2026-10-05/menu-slider-keyboard-tablet.png)
  and
  [phone collection error](evidence/parity-phase-5/inspector-controls-2026-10-05/collection-invalid-phone.png).
  Menu Content/icon, slider and rejected-draft captures exist at all three
  widths.
- T3 status/navigation/snapshot now work. Its click calls also worked after
  correcting an invalid locator argument; the Menu Style surface was inspected
  in the collaborative browser. The explicitly authorized Chromium runner
  remains the repeatable packed-artifact acceptance suite.
- No page exceptions or failed requests were recorded. The existing unattributed
  browser console 404 remains; no corresponding HTTP failure URL was captured.
- `pnpm check` passes formatting, lint, all-workspace TypeScript/tests, parity
  fixtures, all builds (including Next.js/docs), package exports, packed
  consumers, size guardrails and licenses. Core: 61/61; React: 57/57. Generated
  Next.js environment imports were restored. Final harness/evidence/audit
  formatting, lint and `git diff --check` were rerun after capture.
- Sizes: React 901,183 bytes; core 246,854; CSS 70,114; archive 1,373,801;
  tree-shaken core consumer 124,537. Reviewed Slider/icons/draft feedback add
  about 35 KB to React and 26 KB to the compressed archive, including maps.
  Explicit React/CSS/archive guardrails become 905,000/71,000/1,380,000 bytes;
  core and tree-shaken guardrails are unchanged. No dependency was added.

### Remaining Phase 5 work

Source-composed color pickers remain outstanding: Menu color fields still use
validated text inputs. The owner's palette instruction preserves authored
colors; it does not defer or waive the color-picker functionality. The broader
all-Element/all-field command, validation, keyboard and source-visual matrix
still needs closure. This checkpoint does not claim complete manual keyboard or
screen-reader review, React 18 packed browser verification, Next.js browser
verification, or the full source screenshot comparison. Phase 5 remains open;
Phase 6 has not begun.

## Colour control checkpoint — 6 October 2026

Phase 5 remains in progress. The owner's instruction to leave the source colour
palette is preserved: no fixture colour or contrast rule has changed.

### Outcome and interfaces

- Text control metadata adds optional `presentation: "color"` and `allowAlpha`.
  Standard Menu colour controls use the same public definition seam available to
  custom Elements. There is no Document schema change or product-specific UI
  switch. Menu schemas remain opaque six-digit HEX.
- Menu, responsive Style colours and Page design colour Variables now share a
  swatch/popover composition with the source-characterized HSL square, Hue,
  optional Opacity, HEX/RGB/HSL display formats and validated text. Equivalent
  colours and opening/format changes do not dispatch commands. Style reset and
  Variable binding remain available; bound literal inputs/swatches are disabled.
  Colour Variables retain their six/eight-digit HEX contract.
- Draft errors remain outside Documents, Escape restores accepted drafts and
  accepted changes retain existing command/coalescing/Local history paths.
  Editor shortcuts now respect handled keyboard events so popover Escape does
  not also deselect the Element.
- The shadcn skill guided official Popover/Input Group installation after
  current [Popover](https://ui.shadcn.com/docs/components/radix/popover) and
  [Input Group](https://ui.shadcn.com/docs/components/radix/input-group)
  documentation review. Existing primitives were not overwritten; added files
  were inspected and adapted to package imports, heading semantics and reduced
  motion. ReUI remains unavailable. No Kibo UI code was vendored.
- Reviewed `color@5.0.3` and its bundled MIT transitive libraries are
  inventoried; notices ship in `THIRD_PARTY_NOTICES.md` and packed checks
  require each notice. Public-interface documentation records the colour
  presentation contract.

### Verification

- Neutral colour characterization tests were written first, observed failing
  without the implementation, then passed. They cover CSS parsing/normalization,
  alpha restrictions, invalid input, semantic equality and source HSL-square
  corners, clamps and midpoint. SSR tests verify labelled/disabled fields and no
  render-time mutation. Core: 61/61; React: 62/62.
- `pnpm check` passed formatting, lint, all-workspace TypeScript and tests,
  parity fixtures, all builds (including docs/Next.js), package/export checks,
  packed consumers, size guardrails and licence inventory. Generated Next.js
  environment imports were restored. Final evidence/docs/harness formatting,
  lint and `git diff --check` were rerun after capture.
- Initial packed-size verification correctly failed the old 1,380,000-byte
  archive budget. Reviewed parsing, Popover and Input Group costs are explicit:
  final archive 1,425,747 bytes; React 972,742; core 247,028; CSS 76,132;
  tree-shaken core consumer 124,642. Guardrails are now 1,430,000/980,000/77,000
  for archive/React/CSS; core/tree-shaken budgets are unchanged. Notices are
  required in the installed artifact, not just the repository.
- Final `pagebldr@0.0.0-alpha.0` artifact SHA-256:
  `ab1ddf530552976a7c12d89d1088b7bcc213c18e8def3d8669887259e4718bba`, React
  19.2.8, Chromium 147.0.7727.15. The packed Reference Host imports public
  exports and compiled package CSS without presentation fixes in the Host.
- [Results](evidence/parity-phase-5/colour-controls-2026-10-06/results.json):
  **92/117 checks pass**: all 58 functional assertions, all 29 editor-UI axe
  scans and five full-page Variables dialog scans. The other 25 full-page scans
  report authored-content contrast only: 22 retain the 14 source-palette nodes;
  three temporarily edited low-opacity background states expose 17 nodes. No
  rules were disabled or failing raw reports converted to passes. The browser
  command therefore deliberately returns exit status 1.
- Desktop/tablet/phone journeys verify opening/format selection without
  mutation, rejected colour text/Escape, opaque normalization, square pointer
  and keyboard editing, coalesced Undo, popover Escape/focus restoration,
  responsive alpha, reset, disabled Variable bindings and Page design colour
  Variable alpha/Undo. The first browser run exposed popover Escape bubbling
  into editor deselection and an incorrect attempt to edit a bound literal. The
  editor now honors handled events; the test explicitly selects Custom before
  editing, and waits for the closing animation before asserting detachment.
  Screenshot capture finishes animations so intermediate fade frames are not
  treated as visual evidence.
- Inspected final captures include
  [phone Menu colour](evidence/parity-phase-5/colour-controls-2026-10-06/menu-colour-open-phone.png),
  [desktop Style alpha](evidence/parity-phase-5/colour-controls-2026-10-06/style-colour-alpha-desktop.png)
  and
  [tablet Variable alpha](evidence/parity-phase-5/colour-controls-2026-10-06/variable-colour-alpha-tablet.png).
  The
  [trace](evidence/parity-phase-5/colour-controls-2026-10-06/phase5-browser-trace.zip)
  retains interaction evidence. T3 preview status was checked; the expressly
  authorized standalone Chromium runner provides repeatable packed verification.
  No page exceptions, failed requests or HTTP failure URLs were recorded; the
  existing unattributed console 404 remains visible in diagnostics.

### Remaining work and risks

This is a colour-control checkpoint, not a Phase 5 gate completion. The optional
browser Eyedropper, the complete all-Element/all-field
visual/keyboard/validation matrix, source screenshot comparisons, manual
screen-reader review and React 18 and Next.js packed browser journeys remain
unverified or outstanding. Pointer and keyboard coverage is representative, not
a complete assistive-technology review. Broader source-composed inspector
controls still need a field-by-field gate audit. Phase 6 has not begun;
product-owner review is still required before advancing.
