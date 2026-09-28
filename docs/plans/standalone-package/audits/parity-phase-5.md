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
- shadcn Native Select source was reviewed and adapted to the package import and
  full-width inspector layout. The lightweight native primitive keeps the
  aggregate React entry within its current 760,000-byte guardrail.

## Evidence

- [Typed Content controls](evidence/parity-phase-5/typed-content-controls.png)
- [Definition-owned Heading level](evidence/parity-phase-5/typed-heading-control.png)
- [Typed Content-control flow](evidence/parity-phase-5/typed-content-controls-flow.mp4)
- [Typed Destination flow](evidence/parity-phase-5/typed-destinations-flow.mp4)
- [Anchor authoring flow](evidence/parity-phase-5/anchor-authoring-flow.mp4)
- [Image Content flow](evidence/parity-phase-5/image-content-flow.mp4)

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

The ordered-Menu browser flow is still pending. During this checkpoint both T3
preview status and preview open reported that no preview automation host was
available; no alternative browser system was used.

## Verification

- `pnpm check` passed: formatting, lint, type checking, all package tests,
  parity fixtures, all 11 builds, docs checks, public-export checks, packed
  consumer tests, size budgets and license inventory.
- Core: 58 tests passed across 10 files. React: 33 tests passed across 9 files.
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
- The T3 embedded browser exercised the built aggregate package through the Vite
  Reference Host and supplied the linked visual evidence.

## Remaining phase gate

Resource/media and ordered-item Content editors; the complete Style and
remaining Advanced surfaces; Page design and Variables; broader validation
presentation; packed-browser visual assertions; and the full Phase 5
verification matrix remain open.
