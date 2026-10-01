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

## Remaining phase gate

Element-specific inspector refinements; Page design, settings, SEO and Variable
management; broader validation presentation; phone and packed-browser visual
assertions; and the full Phase 5 verification matrix remain open. The shared
media picker and Resource selection stay assigned to Parity Phase 6.
