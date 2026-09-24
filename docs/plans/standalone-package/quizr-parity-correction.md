# Quizr experience parity correction

Status: approved for execution. Parity Phases 0 through 2 were accepted by the
product owner on 22 September 2026. Parity Phase 3 was accepted on 23
September 2026. Parity Phase 4 is complete and awaiting product-owner review.

Baseline: Quizr Page Builder V2 at commit
`7dec26465c454b25545664e84d8e1e91b97ae9d1`

Evidence:
[Quizr Page Builder source-of-truth study](../../research/quizr-page-builder/README.md)

Acceptance system: [Parity acceptance index](parity/README.md)

## Decision

`pagebldr` must reproduce the observable Quizr Page Builder V2 authoring and
published-page experience as its default product-neutral experience. Quizr is
the behavioral and visual baseline, not merely source material for a smaller
editor.

Parity means that a Quizr author should recognize the same workspace, controls,
interaction sequence, responsive behavior, save states, history model and
rendered results without relearning the editor. It does not mean placing Quizr
names, routes, persistence code, media services, quiz records or authorization
policy inside the package. Those services enter through the same Host-facing
interfaces available to every consumer.

Phase 11 release hardening is blocked until this correction program is complete.
The previous phase audits remain accurate records of what was accepted at the
time, but their use of words such as "complete" does not establish parity with
the newly documented Quizr baseline.

## Reference Host is a product surface

`examples/vite-basic` is the **Reference Host**, not a lightweight demo. It is
the primary way the product owner and package developers audit what an external
developer actually receives.

Its default editor route must:

- install and run a freshly packed package artifact for acceptance checks;
- import only public package exports and `pagebldr/styles.css`;
- mount the standard preset with the smallest documented Host wiring;
- contain a representative pre-populated Document rather than an empty root;
- provide realistic local adapters for Resources, lifecycle, Revisions, saved
  Blocks and managed Templates so every package-owned surface can be exercised;
- expose editor, preview and published routes using the same Document;
- use no Host CSS, custom Contributions or replacement components to complete,
  rearrange or visually repair the standard experience; and
- keep extension experiments on clearly separate routes.

Local source-linked development may remain available for fast iteration, but it
is not completion evidence. Every phase gate must also run the packed-artifact
mode in the real browser, capture the relevant desktop/tablet/phone states and
exercise the complete interaction—not merely confirm that a control exists.

The Reference Host evolves in the same phase as each package capability. Work
cannot be deferred to a final example or presentation phase, because an
unobservable or unintegrated feature is not finished.

## Current-state verdict

The repository has a useful engine and packaging foundation. It does not yet
have the Quizr page-builder product.

The current `PagebldrEditor` is a basic three-column demonstration with a top
bar, fixed sidebars, a renderer and generic text inputs. Its standard element
definitions are permissive placeholders, its style inspector does not edit
styles, its libraries do not expose Blocks or Templates, and its save/publish
callbacks do not model the lifecycle visible in Quizr. Browser interaction and
accessibility verification for the editor were also deferred in the Phase 7 and
Phase 9 audits.

The correct response is not to discard the package. It is to retain the deep
engine modules that already match the baseline, replace the shallow placeholder
surfaces and close the lifecycle and runtime semantic gaps before release work.

## What remains trustworthy

These foundations should be evolved rather than rewritten:

- normalized, schema-versioned Documents with an element map and child IDs;
- deterministic Document and Element migrations;
- command-only mutation, patches, inverse patches and bounded Local history;
- clipboard subtree serialization and ID remapping;
- responsive styles, Variables, Classes and deterministic scoped CSS;
- definition-owned validation, child policy, rendering and reference extraction
  as the intended module boundary;
- the controlled React contract in which `onChange` updates Host state;
- SSR-safe renderer and framework-neutral Runtime separation;
- Host-owned resources, routes, authorization, persistence and event sinks;
- optional server orchestration with explicit provider capabilities; and
- compiled package CSS with no Tailwind requirement for consumers.

These are foundations, not evidence that the authoring experience is finished.

## Parity gap matrix

| Area              | Current `pagebldr` state                                                                                               | Quizr parity requirement                                                                                                                                                                                     | Disposition                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Document          | Normalized core shape is close, but settings and semantic validation are smaller.                                      | Add the full settings/SEO shape, anchors, typed destinations, bounds and registry-aware validation described by the baseline.                                                                                | Extend                                                 |
| Commands          | Core structural and style commands exist.                                                                              | Add template application, add-and-assign Class, style copy/paste, history jump and the policies needed by move/indent/outdent and insertion targeting.                                                       | Extend                                                 |
| History           | Undo/redo and coalescing exist.                                                                                        | Use a 100-action/750ms policy, expose action labels and jumping, and preserve history through ordinary save failures/conflicts.                                                                              | Extend                                                 |
| Styling engine    | Three small capabilities and a limited property set compile responsively.                                              | Implement the nine Quizr capability groups, 91-property allowlist, inheritance/origin resolution, reset behavior, forced editor states, typed Variable applicability and stronger unsafe-value rules.        | Replace capability library; extend engine              |
| Standard Elements | Nineteen skeletal definitions with a generic object schema and generated text inputs.                                  | Reproduce all 24 Quizr definitions, exact typed props, versions/migrations, child policies, controls, references, semantics and interactive behavior.                                                        | Replace standard library                               |
| Renderer          | SSR-safe recursive renderer exists.                                                                                    | Match editor/public hidden handling, links, destinations, anchors, media/video resolution, fonts and client widgets for menu, tabs, countdown and gallery.                                                   | Extend substantially                                   |
| Canvas            | In-process renderer inside a bordered div.                                                                             | Isolated frame, shell/canvas bridge, selection and hover overlays, inline editing, drag targets, reveal/scroll, navigation suppression and editor-only hidden representation.                                | Replace                                                |
| Shell             | Fixed desktop three-column layout.                                                                                     | Match the Quizr top bar, toggleable inspector, dotted workspace, floating Structure and zoom island, plus tablet/phone compact header, bottom toolbar and overlays.                                          | Replace                                                |
| Structure         | Static tree in the left sidebar with selection only.                                                                   | Movable/resizable window, expand/collapse, synchronization, indicators, menus, valid drag positions, tree keyboard navigation and structural shortcuts.                                                      | Replace                                                |
| Inspector         | Generic scalar fields; style tab only lists capability names.                                                          | Definition-specific Content controls and complete Style/Advanced panels, responsive/state editing, inherited-value origins, reset actions and anchor management.                                             | Replace                                                |
| Libraries         | Elements are buttons; Blocks and Templates are absent from the editor.                                                 | One searchable Add-to-page surface with Elements, 23 standard Blocks, saved Blocks, six Featured Templates, optional managed Templates, filtering, favourites, previews, click insertion and drag insertion. | Replace and extend public definitions                  |
| Media             | A Resource adapter can resolve and optionally browse. No picker exists.                                                | Shared responsive picker with Add/Gallery flows, pending selection, filtering/sorting/layouts, upload/external URL capabilities, viewer and per-usage accessibility data.                                    | Deepen Resource interface and build UI                 |
| Page design       | No page-level editing UI.                                                                                              | Design, Page settings, SEO/social metadata and Variables dialog with bounds, reset, usage counts and reordering.                                                                                             | Add                                                    |
| Preview           | A renderer mode exists but the standard editor has no preview workflow.                                                | Top-bar preview of the current local Document, chrome removal, disabled navigation, Escape/return flow and no save side effect.                                                                              | Add                                                    |
| Save lifecycle    | Manual callback status local to the shell; no autosave controller.                                                     | Dirty/Saving/Saved/Failed/Conflict state machine, 900ms serialized autosave, exact-revision tracking and retry behavior.                                                                                     | Add deep editor lifecycle module                       |
| Revisions         | Optional server rows contain only ID, version and timestamp; editor has no revision UI.                                | Explicit save/publish/restore kinds, actor metadata, live marker, retention semantics, preview, append-only restore and Actions/Revisions History sheet.                                                     | Extend server contract and add optional editor surface |
| Publish           | Current server publishes an existing revision without expected-version comparison or an atomic submitted draft update. | Atomically compare revision, save submitted draft, publish the same snapshot, update references/metadata, create publish revision and emit events; support unpublish without deleting the draft.             | Correct semantics                                      |
| Recovery          | Not implemented.                                                                                                       | Validated local recovery payload, recover/discard prompt, conflict on mismatched server revision and recovery JSON download.                                                                                 | Add optional controlled module                         |
| Responsive editor | Canvas width toggles only.                                                                                             | Separate authored breakpoints from shell breakpoints; preserve full authoring on desktop, tablet and phone with 44px touch targets.                                                                          | Replace shell behavior                                 |
| Accessibility     | Primitive-level behavior exists; end-to-end review was deferred.                                                       | Keyboard parity, tree semantics, drag alternatives, dialogs/sheets, announcements, focus management, forced colors, reduced motion and manual keyboard evidence.                                             | Verify and correct                                     |
| Visual fidelity   | Generic shadcn defaults.                                                                                               | Reproduce the captured layout, density, hierarchy, cards, panels, dialogs, selection chrome, dotted canvas and responsive choreography using neutral theme tokens.                                           | Restyle from evidence                                  |
| Reference Host    | Minimal workspace-linked Vite example with custom Contributions and no full-flow visual proof.                         | Packed public package, standard preset, package styling and realistic local adapters expose the complete installed experience without Host repairs.                                                          | Replace as first-class product surface                 |
| Tests             | Stronger at core/server interfaces; editor tests are almost absent.                                                    | Characterization, interaction, visual and accessibility tests tied to the Quizr evidence and public package interface.                                                                                       | Add before claiming parity                             |

## Required corrections to public contracts

Public interfaces should remain small. The plan must deepen a few modules rather
than export every Quizr component or editor state field.

### Element definition

The current `ElementControl` shape of `{ key, label }` and the shared permissive
object schema cannot express Quizr's authoring behavior. A definition must own:

- a real typed prop schema and exact defaults;
- element version and sequential prop migrations;
- child policy and structural affordances;
- Content controls, ordered-list editors and element-specific Style controls;
- supported Style/Advanced capabilities;
- inline-edit behavior where applicable;
- edit, preview and public rendering behavior;
- client-widget behavior without making core depend on React or the DOM;
- accessibility rules and publication validation; and
- Resource and destination reference extraction.

The extension interface must be proven with a third-party interactive Element,
not only static render output.

### Blocks and Templates

The current definitions expose only a key, label and tree factory. They need the
metadata and operations the Quizr library uses: description, category, search
terms, thumbnail, preview data and fresh-ID creation. Templates must create or
apply a complete Document, not only an `ElementTree`, and template application
must preserve the selected page identity fields.

Saved Blocks and managed Templates are Host data sources presented through
ordinary library-source adapters. The package owns their common UI and
insertion/application behavior; the Host owns storage, assignment and access.

### Resources and media

`ResourceAdapter.browse()` is too shallow for the shared picker. The resource
seam needs capability-based browsing, creation/upload, cancellation, retry,
external references, inspection/preview, kinds, pagination and selection
metadata. The package should not invent a generic file service. It should own a
deep picker controller and UI that operate against declared adapter
capabilities.

Two materially different adapters must prove the interface before it is frozen:
the local/example adapter and Quizr's eventual Host adapter. Unsupported
capabilities must disappear from the UI rather than fail after interaction.

### Editor lifecycle

Do not add a large set of unrelated callbacks directly to `PagebldrEditorProps`.
Introduce one controlled lifecycle interface that can describe:

- loaded server revision and publication state;
- autosave and explicit save intents;
- publish/update and unpublish intents;
- durable revision listing, preview and restore;
- pending, success, failure and conflict results;
- read-only state and reason; and
- optional recovery storage.

The package owns the Quizr state machine and presentation. The Host performs
transport and policy. Callback-only integration and `pagebldr/server`
integration must drive the same editor behavior.

### Server lifecycle

The current optional server module needs lifecycle semantics, not merely CRUD
with revision rows:

- distinguish autosave from explicit save;
- create durable Revisions only for explicit save, publish and restore;
- carry operation IDs for idempotent explicit mutations;
- require expected revision for every replacing mutation;
- publish the submitted Document and its snapshot atomically;
- classify Revisions by kind and retain actor/title metadata;
- protect the live Revision during retention;
- keep restore append-only and leave publication unchanged;
- keep unpublish independent of the draft; and
- update extracted draft/published references within the same lifecycle
  boundary.

Provider conformance must be rerun against these stronger guarantees.

### Editor composition

The existing public Slot/Contribution API should not determine the internal
layout. Quizr's standard preset must be implemented first as one cohesive deep
module. Contributions may add documented actions, panels and sources, but must
not be able to replace internal state, canvas protocol or accessibility policy.

The `focus` preset currently proves only that two fixed sidebars can swap. It is
not meaningful product variation and should not be treated as evidence of a
stable composition design. Revalidate or reduce the public composition surface
after the real shell exists.

## Internal module boundaries

The implementation should converge on these deep internal modules. Names are
descriptive and need not become public exports.

- **Editor controller** — selection, hover, authored viewport/state, preview,
  panels, zoom, insertion targeting, keyboard map and command dispatch.
- **Canvas bridge** — isolated-frame readiness, Document updates, selection,
  hover, inline edits, geometry, scroll/reveal, drag targets and link
  suppression.
- **Lifecycle controller** — dirty tracking, serialized autosave, save state,
  conflict, publication, recovery and interaction with Host callbacks.
- **Structure controller** — expanded nodes, placement validation, movement,
  indicators and accessible tree behavior.
- **Inspector controller** — resolved style value/origin, reset/set commands,
  responsive/state context, control rendering and publication issues.
- **Library controller** — search, categories, source aggregation, preview,
  insertion/application and saved-content actions.
- **Resource picker controller** — capability negotiation, upload queue, pending
  selection, browse state, viewer and commit/cancel semantics.
- **Runtime widgets** — definition-owned client behavior for interactive
  Elements over the same declarative render contract.

These modules provide locality: a save-state change should not require edits to
the canvas or element registry, and a new Element should not require edits to a
central renderer or inspector switch.

## Corrective delivery phases

The phases below replace the assumption that Phase 11 is next. Work remains
strictly one phase at a time. Each phase requires a written audit and
product-owner review before the next begins.

For every phase below, the work includes integrating that phase's observable
behavior into the Reference Host during the same phase. Its gate includes a
packed-artifact browser audit and visual evidence. Unit tests, build output or a
workspace-linked example cannot satisfy the gate by themselves.

### Parity Phase 0 — freeze evidence and acceptance fixtures

Work:

- Convert every research screenshot and documented interaction into a named
  acceptance case.
- Create package-native Documents corresponding to the inspected Quizr page,
  representative deep content, every Element and every responsive state.
- Record exact visual viewports for desktop, tablet and phone comparisons.
- Record interaction traces for library insertion, selection, inline editing,
  Structure operations, styling, media selection, preview, save, history and
  restore.
- Define the Reference Host's packed-artifact mode, standard routes, seeded
  Documents, local adapter capabilities and screenshot/recording matrix.
- Update the product specification and domain language where this plan changes
  requirements, especially built-in optional Revision UI.

Gate: every promised behavior has evidence, a package-native fixture and an
explicit parity assertion, and every journey has an auditable Reference Host
route/state. No implementation begins before this gate is approved.

### Parity Phase 1 — engine and schema completion

Work:

- Complete Document settings, SEO, anchors and typed destinations.
- Add missing commands and policies, history jump and exact coalescing limits.
- Complete Style capabilities, safe property grammar, inheritance/origin
  resolution, forced editor states and typed Variables.
- Add copy/paste style and template application as ordinary commands.
- Write neutral characterization tests before changing extracted behavior.

Gate: Quizr-equivalent Documents and command sequences produce equivalent
validated state and CSS, with no React or product dependency in core.

### Parity Phase 2 — standard library and runtime completion

Work:

- Replace the generic standard definitions with all 24 typed definitions.
- Implement missing Logo, Menu, Copyright, Icon List and Progress Elements.
- Replace plain Text behavior with structured Rich Text.
- Complete versions/migrations for Image, Video, Progress and Gallery.
- Implement typed destinations, anchors, media rules, approved fonts and
  interactive widgets.
- Ensure hidden nodes are discoverable only in edit mode and omitted publicly.

Gate: every Element passes SSR, hydration, accessibility, migration, Resource
and editor/public parity tests through its definition.

### Parity Phase 3 — editor controller and isolated canvas

Work:

- Replace the in-process canvas with the isolated canvas and typed bridge.
- Implement readiness/error states, synchronized selection/hover, geometry,
  reveal, editor-only hidden nodes and navigation suppression.
- Implement inline editing, drop zones, move targets and keyboard alternatives.
- Implement Desktop fixed/fill, Tablet and Mobile authored views plus 25–200%
  zoom, Fit and scroll-to-selection.

Gate: the package-native fixture can be authored through the canvas without any
direct Document mutation, and the bridge has integration tests for every message
family and failure state.

### Parity Phase 4 — shell and Structure fidelity

Work:

- Rebuild the top bar and its desktop/narrow action placement.
- Implement the toggleable Add/Inspector panel, dotted workspace, zoom island
  and movable/resizable Structure window.
- Implement Structure expansion, menus, copy/paste, style copy/paste, duplicate,
  rename, movement, indent/outdent, visibility, locking, save as Block and root
  restrictions.
- Implement full preview entry/exit and responsive tablet/phone overlays and
  bottom controls.

Gate: screenshot comparisons and recorded interaction tests match the Quizr
shell at all target viewports; keyboard-only use covers the complete Structure
flow.

### Parity Phase 5 — inspectors and Page design

Work:

- Implement definition-driven Content controls for all Elements.
- Implement Style and Advanced groups, Normal/Hover/Focus, authored breakpoint,
  inheritance origins, per-property reset and reset-all.
- Implement element-specific controls such as menu appearance and gallery
  layout.
- Implement anchor validation and destination discovery.
- Implement the Page design dialog for design values, settings, SEO/social
  metadata and Variable management.

Gate: every editable field has a command, coalescing policy, validation/error
state, keyboard path and visual parity assertion.

### Parity Phase 6 — libraries, Blocks, Templates and media

Work:

- Build the unified searchable Elements/Blocks/Templates library.
- Port the 23 standard Blocks and six Featured Templates as neutral package
  definitions with matching visual designs.
- Add Host sources for saved Blocks and managed Templates, including preview,
  insertion/application and allowed management actions.
- Build the shared media picker, upload/browse capability UI, viewer and
  per-usage accessibility controls.
- Apply exact insertion targeting, fresh-ID and reference adaptation behavior.

Gate: every catalogue item inserts or applies into a valid ordinary Document;
the example adapter exercises all package-owned media behavior and a second
adapter proves the seam.

### Parity Phase 7 — lifecycle, History and recovery

Work:

- Implement the lifecycle controller and visible save-state model.
- Add 900ms serialized autosave without durable Revision creation.
- Add explicit Save draft, Publish/Update, Unpublish and publication validation.
- Implement the combined History sheet for local Actions and durable Revisions,
  including jump, preview and append-only restore.
- Implement conflict preservation/recovery and validated local recovery.
- Strengthen server lifecycle semantics and rerun every adapter conformance
  suite against real supported Providers.

Gate: scripted multi-session conflict, lost-response idempotency, autosave while
editing, save/publish/restore retention and recovery scenarios match the
baseline without data loss.

### Parity Phase 8 — responsive, accessibility and visual proof

Work:

- Tune tokens, spacing, density, cards, dialogs, sheets, overlays and selection
  chrome against the captured evidence.
- Complete tablet and phone authoring, not only preview.
- Run automated accessibility checks in every revealed state.
- Complete a documented manual keyboard, focus, screen-reader announcement,
  forced-colors and reduced-motion review.
- Add visual regression baselines and browser/React matrices using packed
  artifacts in Vite and Next.js.

Gate: no unexplained visual or interaction difference remains in the parity
matrix. Approved differences must be documented as intentional package
neutralization, never as missing behavior.

### Parity Phase 9 — public API consolidation and release readiness

Work:

- Remove or revise provisional public APIs that the real editor proved shallow.
- Confirm Contributions can extend the completed experience without exposing
  stores, DOM structure or canvas protocol.
- Rewrite examples and documentation around the finished default experience.
- Run the full package, provider, packed-consumer, browser, accessibility,
  performance and visual suites.
- Only then resume the original Phase 11 prerelease work.

Gate: an unrelated Host and the future Quizr adapter can both integrate the same
package interfaces without a privileged path or package change.

## Non-negotiable acceptance journeys

Parity is not complete until all of these work in packed consumer applications:

1. Open a populated Document, search Elements, click and drag insert, select in
   canvas and Structure, inline-edit text, move/indent/outdent, undo/redo and
   jump through Actions.
2. Author Desktop, Tablet and Mobile styles; inspect Normal, Hover and Focus;
   reset inherited values; edit Variables; and observe matching preview/runtime
   CSS.
3. Insert every Block, preview and apply every Featured Template, save a subtree
   as a Host-backed Block and apply a managed Template from a Host source.
4. Select/upload media through the shared picker, cancel without committing,
   commit ordered gallery items, edit per-usage accessibility data and satisfy
   publication validation.
5. Preview the unsaved local Document without navigation, return to the same
   selection and publish only through the explicit lifecycle action.
6. Autosave during continued editing without losing later changes, create an
   explicit save Revision, publish/update, preview and restore an old Revision,
   and confirm restore does not change the live page until republished.
7. Produce an optimistic conflict from a second session, preserve local history
   and recovery data, and complete the deliberate recovery path without silent
   overwrite.
8. Complete the authoring journey with keyboard only at desktop and phone shell
   widths, with correct announcements and no inaccessible drag-only operation.
9. Render the same published Document through Vite and Next.js with matching
   metadata, Resources, interactive widgets and responsive output.
10. Install the packed artifact into a clean Reference Host, follow only the
    documented minimal setup, import the package stylesheet and obtain the full
    styled editor with every standard feature—without copying components, adding
    editor CSS or designing missing presentation.

## Explicit non-parity boundaries

The following remain Host responsibilities and are not reasons for the default
editor to look or behave differently:

- authentication, authorization, billing and organisation/site scope;
- Quizr tRPC procedures, database models, route names and notifications;
- Quiz records and Quizr-specific destination lookup;
- the Quizr media backend and upload credentials;
- application navigation and surrounding product chrome;
- public-domain rewrites and legal/footer policy; and
- event retention, privacy, consent and operational infrastructure.

The package supplies neutral destinations, Resources, lifecycle adapters,
library sources and Contributions so those Host capabilities appear in the same
places and interaction patterns as they do in Quizr.

## Documentation and audit policy

- Do not rewrite historical phase audits to imply they tested the new parity
  target.
- Add `parity-phase-<n>.md` audits under `audits/` after each approved phase.
- Each audit must link the acceptance cases, screenshots, browser traces,
  accessibility evidence and focused/public-interface tests it actually ran.
- Each audit must identify the packed package version/hash used by the Reference
  Host and confirm that its default route contains no presentation repairs.
- A phase cannot be declared complete when browser interaction, visual or
  keyboard verification was unavailable; it remains incomplete until that
  evidence exists.
- Do not begin the next phase until the product owner reviews the current gate.
