# Quizr parity acceptance cases

Each case describes behavior observable through a public package interface or
the Reference Host. The linked source study is the authority for expected
behavior; the case ID is the stable name used by tests, screenshots and audits.

## Shell, canvas and Structure

| ID           | Acceptance                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SHELL-01`   | Desktop shows Exit, panel toggle, editable title/Home marker, save state, authored view, undo/redo, Structure, Preview, primary publication and More actions in the Quizr hierarchy. |
| `SHELL-02`   | Tablet/phone retain primary publication in the header and move secondary actions into More actions with 44px targets.                                                                |
| `SHELL-03`   | Left panel switches between searchable Add-to-page and selected-Element inspector; Back returns without losing editor state.                                                         |
| `SHELL-04`   | Tablet/phone panel and Structure are independently movable overlays with compact bottom controls.                                                                                    |
| `CANVAS-01`  | Canvas is isolated and completes a typed readiness/document/interaction handshake without leaking its DOM as a public interface.                                                     |
| `CANVAS-02`  | Canvas click/hover and Structure selection/hover synchronize bidirectionally and reveal the target.                                                                                  |
| `CANVAS-03`  | Selection outline, type label and editor affordances track geometry under scrolling and zoom.                                                                                        |
| `CANVAS-04`  | Supported text begins inline editing by double-click or Enter and commits through commands.                                                                                          |
| `CANVAS-05`  | Click/drag insertion and movement show only valid before/inside/after targets and reject invalid drops.                                                                              |
| `CANVAS-06`  | Hidden Elements remain marked/selectable in edit mode and are absent from preview/published rendering.                                                                               |
| `CANVAS-07`  | Links never navigate in edit or editor Preview.                                                                                                                                      |
| `ZOOM-01`    | Zoom supports 25–200%, Fit at 25–100%, plus/minus and scroll-to-selection; narrow shells expose the same behavior in a popover.                                                      |
| `VIEW-01`    | Authored Desktop fixed/fill, Tablet and Mobile views are independent from shell responsiveness and use Document breakpoint settings.                                                 |
| `PREVIEW-01` | Preview renders the unsaved local Document, removes authoring chrome/interactions, does not save/publish and returns through Escape/action.                                          |
| `STRUCT-01`  | Structure is movable, resizable, resettable, collapsible and closable; tree expansion state is independent from Document history.                                                    |
| `STRUCT-02`  | Indicators distinguish hidden, locked, responsive-hidden and broken references.                                                                                                      |
| `STRUCT-03`  | Menu exposes edit, clipboard, style clipboard, duplicate, rename, movement, indent/outdent, visibility, lock, save Block and delete according to command availability.               |
| `STRUCT-04`  | Root and locked restrictions match the command engine and are communicated before mutation.                                                                                          |
| `STRUCT-05`  | Tree arrows traverse/expand/collapse and Alt+Arrow performs valid move/indent/outdent operations.                                                                                    |

## Inspectors and page design

| ID            | Acceptance                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT-01`  | Every Element definition supplies its typed Content controls, including ordered item editors and typed destinations.                |
| `CONTENT-02`  | Continuous text/numeric edits coalesce into one sensible Action within 750ms.                                                       |
| `STYLE-01`    | Style exposes element-specific controls, Normal/Hover/Focus Visible, active authored breakpoint and reset-all.                      |
| `STYLE-02`    | Typography and Background expose all documented fields and every property can reset to inheritance.                                 |
| `STYLE-03`    | Values identify local, Class and wider-breakpoint origins; dormant Class authoring remains hidden while Class values still resolve. |
| `ADV-01`      | Advanced exposes only registered Layout, Size, Spacing, Border, Effects, Position and responsive Visibility capabilities.           |
| `ANCHOR-01`   | Anchor IDs are unique lowercase slugs and destination choices show addressable Elements only.                                       |
| `DESIGN-01`   | Page design edits content width, tablet/mobile maximums and reset defaults within bounds.                                           |
| `DESIGN-02`   | Page settings owns default-header intent without rendering Host chrome in the package.                                              |
| `SEO-01`      | Page/SEO edits search/social titles/descriptions, social image and noindex with documented bounds/fallbacks.                        |
| `VARIABLE-01` | Variables support six kinds, add/edit/rename/reorder/delete, usage counts, applicability and guarded deletion.                      |

## Elements, libraries and media

| ID            | Acceptance                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ELEMENT-01`  | The standard registry contains exactly the 24 target definitions in the fixture inventory with typed schemas/defaults/versions/child policies/capabilities/controls/rendering/references. |
| `ELEMENT-02`  | Image, Video, Progress and Gallery migration chains reach their target versions deterministically.                                                                                        |
| `ELEMENT-03`  | Menu, Tabs, Countdown and Gallery hydrate definition-owned interactive behavior without a central type switch.                                                                            |
| `DEST-01`     | External, anchor, email, telephone and Host application destinations resolve safely and broken references surface before publication.                                                     |
| `LIB-01`      | One search field and Elements/Blocks/Templates tabs search appropriate metadata and preserve tab/filter state.                                                                            |
| `BLOCK-01`    | The package supplies the documented 23 standard Blocks; insertion remaps IDs/references and produces ordinary editable Elements.                                                          |
| `BLOCK-02`    | Saved Blocks are Host-backed, scoped, validated, capped at 50 and disconnected from inserted copies.                                                                                      |
| `TEMPLATE-01` | Six Featured Templates expose metadata, category, favourite, preview and explicit apply.                                                                                                  |
| `TEMPLATE-02` | Apply replaces design content while preserving Document ID, page title, slug and selected SEO identity, then selects root and Fits zoom.                                                  |
| `TEMPLATE-03` | Assigned managed Templates share the UI/application path; unassigned entries never appear.                                                                                                |
| `MEDIA-01`    | Picker contract enforces allowed kinds, cardinality, existing IDs, maximum and accessibility policy.                                                                                      |
| `MEDIA-02`    | Cancel/close/Escape/overlay discard pending selection; only Select commits and zero selection disables it.                                                                                |
| `MEDIA-03`    | Upload queue supports ten files, automatic progress, cancel/retry/remove and survives picker tab/closure during the session.                                                              |
| `MEDIA-04`    | External URL validates HTTPS and detected/allowed kind.                                                                                                                                   |
| `MEDIA-05`    | Gallery search/filter/sort/view modes, virtualization, ordered selection, limits and viewer behave responsively.                                                                          |
| `MEDIA-06`    | Image/Gallery usage stores independent alt/confirmed/decorative/caption data and publication validation enforces it.                                                                      |
| `VIEWER-01`   | Viewer safely presents supported image/video/audio/PDF/text data, download-only office files and unavailable records, stopping playback on close.                                         |

## Styling, lifecycle and runtime

| ID            | Acceptance                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENGINE-01`   | Document validation enforces normalized-tree, registry, settings, destination, anchor, Class, Variable and style-capability invariants.                                             |
| `ENGINE-02`   | Commands are the only mutation path and every success/refusal produces deterministic patches/labels.                                                                                |
| `HISTORY-01`  | Local history holds 100 Actions, supports undo/redo/jump/coalescing and never represents durable Revisions.                                                                         |
| `CLIP-01`     | Clipboard includes only referenced subtree/Class/Variable data, accepts valid system JSON, remaps internal references and rejects invalid paste.                                    |
| `CSS-01`      | Compiler implements Desktop→Tablet→Mobile inheritance, state fallback, ordered Classes, local precedence, forced editor states and safe deterministic output for all 91 properties. |
| `SAVE-01`     | 900ms autosave is serialized, revision-aware and never loses edits made during an in-flight request or creates a durable Revision.                                                  |
| `SAVE-02`     | Save states are Saved/Dirty/Saving/Failed/Conflict with distinct retry and resolution behavior.                                                                                     |
| `REV-01`      | Explicit Save creates one idempotent durable save Revision; retention keeps newest 50 while protecting live.                                                                        |
| `PUB-01`      | Publish/Update validates the submitted Document and atomically writes draft, published snapshot, revision, references, metadata and events after expected-revision comparison.      |
| `PUB-02`      | Unpublish removes public state/references and leaves the draft intact.                                                                                                              |
| `REV-02`      | History distinguishes Actions/Revisions; cards show kind, number, time, actor, title, live, preview and allowed restore.                                                            |
| `RESTORE-01`  | Restore requires saved local state, is idempotent/revision-aware, appends a restore Revision and never changes live publication.                                                    |
| `CONFLICT-01` | Conflict pauses unsafe operations and preserves local Document, selection, undo/redo and validated recovery/download data.                                                          |
| `RECOVERY-01` | Matching recovery resumes dirty; mismatched recovery resumes Conflict; invalid recovery is removed safely.                                                                          |
| `RUNTIME-01`  | Runtime resolves only published Documents, migrates/validates, prepares Resources/metadata/cache/event context and never substitutes a draft.                                       |
| `RUNTIME-02`  | Edit/Preview/Public modes implement their documented selection, hidden, link, unknown and Resource differences.                                                                     |
| `RUNTIME-03`  | Video resolution, approved fonts, metadata fallbacks and responsive output match the Document contract.                                                                             |
| `EVENT-01`    | Audit and consent-aware Analytics events remain distinct, redacted and delivered only to Host sinks.                                                                                |

## Installation, accessibility and failure states

| ID           | Acceptance                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTALL-01` | A clean Vite Host obtains the complete standard editor from packed public exports plus `pagebldr/styles.css` and minimal controlled wiring. |
| `INSTALL-02` | No consumer Tailwind/shadcn/ReUI setup, copied source, Host editor CSS or internal import is needed.                                        |
| `INSTALL-03` | Reference Host default route is free of custom Contributions; extension demonstrations are isolated.                                        |
| `A11Y-01`    | All pointer operations have keyboard equivalents, visible focus and correct accessible names/roles/states.                                  |
| `A11Y-02`    | Dialogs/sheets/menus manage focus, announce errors/status and have no traps; Structure follows tree semantics.                              |
| `A11Y-03`    | Editor supports zoom/reflow, forced colors and reduced motion; tablet/phone controls meet 44px targets.                                     |
| `POLICY-01`  | Read-only preserves browsing, Structure, preview, Revision preview and inspection while disabling mutation with a reason.                   |
| `ERROR-01`   | Loading, empty, unknown Element, Resource failure, save failure and conflict states preserve a stable accessible shell and recovery path.   |

## Source coverage

| Source study                         | Covered cases                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor experience                    | `SHELL-*`, `CANVAS-*`, `ZOOM-*`, `VIEW-*`, `PREVIEW-*`, `STRUCT-*`, `CONTENT-*`, `STYLE-*`, `ADV-*`, `ANCHOR-*`, `DESIGN-*`, `SEO-*`, `VARIABLE-*`, `A11Y-*`, `POLICY-01`, `ERROR-01` |
| Document engine and styling          | `ENGINE-*`, `HISTORY-01`, `CLIP-01`, `CSS-01`, `STYLE-*`, `VARIABLE-01`, `ELEMENT-02`                                                                                                 |
| Elements, Blocks and Templates       | `ELEMENT-*`, `DEST-01`, `LIB-01`, `BLOCK-*`, `TEMPLATE-*`                                                                                                                             |
| Media and runtime                    | `MEDIA-*`, `VIEWER-01`, `RUNTIME-*`, `DEST-01`, `EVENT-01`                                                                                                                            |
| Persistence, history and publication | `SAVE-*`, `REV-*`, `PUB-*`, `RESTORE-01`, `CONFLICT-01`, `RECOVERY-01`, `POLICY-01`                                                                                                   |
| Reference Host requirement           | `INSTALL-*` and every named interaction trace                                                                                                                                         |
