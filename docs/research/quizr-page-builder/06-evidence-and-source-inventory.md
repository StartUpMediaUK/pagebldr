# Evidence and source inventory

## Evidence baseline

- Quizr repository: `D:\Documents\dev\quizr`
- Pinned HEAD inspected: `7dec26465c454b25545664e84d8e1e91b97ae9d1`
- Quizr worktree state at inspection: clean
- Live editor observed: `brand-awareness Home` for `acme-inc/brand-awareness`
- Observation date: 22 September 2026
- Browser: authenticated T3 Code embedded collaborative preview only
- Mutation policy: panels, tabs, preview, authored view and viewport were
  inspected; no field value was changed; no block/template/media was committed;
  Save draft, Publish/Update, Restore and Unpublish were not invoked

## Source hierarchy used

1. Live staging for currently exposed UI, labels, layout and interaction
   presence.
2. Pinned implementation for engine, validation, rendering, persistence and
   non-visible edge behaviour.
3. Completed product specifications/audits for intended empty, loading, error,
   accessibility and operational states.

Prototype routes were inventoried but not treated as current product truth when
the production editor/runtime supplied the same concern.

## Core engine

Directory: `src/lib/page-builder-v2`

| File                           | Responsibility                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `constants.ts`                 | Format/version, default breakpoints/content width, style properties/states/capabilities and variable kinds. |
| `schema.ts`                    | Strict Zod document, element, class, variable, SEO, responsive-style and clipboard schemas.                 |
| `types.ts`                     | Inferred public engine types.                                                                               |
| `document.ts`                  | Parse/clone/create document helpers.                                                                        |
| `validation.ts`                | Registry-aware global document and tree validation.                                                         |
| `errors.ts`                    | Typed engine failure codes/details.                                                                         |
| `ids.ts`                       | Element/class/variable ID factories.                                                                        |
| `commands.ts`                  | Command union and validated command execution.                                                              |
| `patches.ts`                   | Forward/inverse patch generation and application.                                                           |
| `history.ts`                   | Local action history, coalescing, undo/redo/jump and retention.                                             |
| `clipboard.ts`                 | Subtree serialization, dependency collection, ID/reference remapping and paste adaptation.                  |
| `responsive.ts`                | Breakpoint/state/class/local cascade resolution.                                                            |
| `css-compiler.ts`              | Safe scoped CSS, variables, media queries and editor forced-state rules.                                    |
| `migrations.ts`                | Sequential document migration and per-element prop migration orchestration.                                 |
| `page-settings.ts`             | Settings helpers/defaults.                                                                                  |
| `font-library.ts`              | Approved font families and legacy aliases.                                                                  |
| `publish-policy.ts`            | Quiz-reference publication checks.                                                                          |
| `media-integration.ts`         | Asset selection patches, ordered gallery append and unconfirmed-image collection.                           |
| `persistence.ts`               | Engine-side lifecycle/reference helpers shared with the server adapter.                                     |
| `api-schema.ts`                | Typed draft/save/publish/unpublish/revision/restore/saved-block request schemas.                            |
| `managed-template-schema.ts`   | Managed-template metadata and save/assignment validation.                                                   |
| `template-catalogue-policy.ts` | Organisation-assignment helpers.                                                                            |
| `fixtures.ts`                  | Package-native engine fixtures used by characterization tests.                                              |
| `index.ts`                     | Engine exports.                                                                                             |

Associated characterization tests cover commands, document validation, engine
invariants, fonts, media integration, page settings, persistence, publish
policy, managed templates and runtime migrations.

## Registries

Directory: `src/lib/page-builder-v2/registries`

- `element-registry.ts`: all 24 definitions, prop schemas/defaults, child rules,
  versions/migrations and style capabilities.
- `control-registry.ts`: text, number, select, toggle, dimensions, colour and
  link-destination control metadata.
- `style-capability-registry.ts`: capability-to-property definitions and
  compatibility checks.
- `library-registry.ts`: block/template definitions, metadata, ordering and
  fresh document/clipboard creation.
- `index.ts`: registry exports.

## Templates and blocks

Directory: `src/lib/page-builder-v2/templates`

- `core-library.ts`: the 23 repository blocks, shared block design
  tokens/classes and registration of six Featured templates.
- `growth-bottleneck-audit.ts`
- `independent-work-study.ts`
- `business-health-index.ts`
- `business-pulse.ts`
- `solution-fit-finder.ts`
- `project-fit-enquiry.ts`
- `leverage-quotient.ts`: managed-template import document, not a Featured
  catalogue entry.
- `index.ts`

`leverage-quotient.test.ts` validates the managed-template document. Large
template source files are significant source material: they demonstrate
realistic deep trees, anchors, menus, variables, shared classes, responsive
overrides and composed runtime elements beyond small fixtures.

## Renderer and public runtime

- `src/lib/page-builder-v2/runtime.tsx`: recursive renderer, element renderers,
  destination and media resolution, editor/public differences and runtime root.
- `src/lib/page-builder-v2/runtime-widgets.tsx`: tabs, countdown, menu and
  gallery/carousel client state plus widget styles.
- `src/lib/page-builder-v2/runtime-migrations.test.tsx`: old-element
  rendering/migration characterization.
- `src/app/(routes)/sites/[siteId]/[[...slug]]/page.tsx`: public site
  resolution, published snapshot selection, metadata, Host header/footer,
  quiz/media resolvers and tracking.
- `src/server/page-builder-v2/public-version.ts`: authoritative
  published-version selection.

## Production editor

Directory: `src/components/site-page-builder-v2/editor`

| File                                             | Responsibility                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `editor-workspace.tsx`                           | Loads controlled store, wires API mutations, autosave, conflict/recovery, publication and saved blocks.   |
| `editor-shell.tsx`                               | Responsive shell, toolbar, canvas, shortcuts, clipboard, insertion, preview, zoom, Structure and dialogs. |
| `editor-shell-responsive.ts`                     | Editor presentation breakpoints, action grouping, canvas fit and overlay geometry.                        |
| `editor-store.ts`                                | Controlled local editor state and document-history integration.                                           |
| `editor-canvas.tsx`                              | Isolated renderer frame integration.                                                                      |
| `editor-bridge.ts`                               | Shell↔canvas message contract.                                                                            |
| `editor-panel.tsx`                               | Elements/Blocks/Templates library and selected-element Content/Style/Advanced inspector composition.      |
| `element-general-controls.tsx`                   | Type-specific Content controls.                                                                           |
| `element-style-controls.tsx`                     | Menu, Logo and Gallery element-specific visual controls.                                                  |
| `destination-controls.tsx`                       | Typed destination authoring.                                                                              |
| `element-id-control.tsx`, `element-anchor-id.ts` | Anchor-ID editing/normalization.                                                                          |
| `editor-style-panel.tsx`                         | Responsive stateful local/class styling, inheritance display, resets and capability panels.               |
| `class-manager-panel.tsx`                        | Full class management component; current assignment UI gated off.                                         |
| `variable-manager-panel.tsx`                     | Page-variable CRUD, ordering, kind/value editors and usage counts.                                        |
| `page-design-dialog.tsx`                         | Breakpoints/content width, default header, page/SEO and variables.                                        |
| `editor-structure.tsx`                           | Hierarchy tree, drag/drop, keyboard navigation, indicators and action menus.                              |
| `editor-structure-position.ts`                   | Persisted/clamped floating Structure geometry.                                                            |
| `editor-history-sheet.tsx`                       | Local Actions, durable Revisions, preview and guarded Restore.                                            |
| `editor-recovery.ts`                             | Validated local recovery payload and site-specific storage key.                                           |
| `editor-operations.ts`                           | Element catalogue, insertion/move/publish helpers and editor orchestration utilities.                     |
| `editor-types.ts`                                | Editor option and integration types.                                                                      |
| `editor-viewport.ts`, `editor-width-control.ts`  | Authored viewport and width resolution.                                                                   |
| `template-library-policy.ts`                     | Featured/My-template display and filtering policy.                                                        |
| `managed-template-editor-workspace.tsx`          | Editor reuse through managed-template persistence.                                                        |

Every behaviour-focused file listed above has adjacent tests where
state/geometry/policy can be characterized without a browser.

## Controls

Directory: `src/components/site-page-builder-v2/controls`

- `style-inputs.tsx`: resettable/inheritable colour, unit, select, toggle, box,
  variable and composite style inputs.
- `color-input-value.ts`: colour parsing/normalization.
- `unit-options.ts`: compatible unit and keyword policy.

## Editor routes

- `src/app/(routes)/d/[organisationSlug]/[siteId]/pages/editor/page.tsx`:
  authenticated production editor route and initial data.
- `src/app/(routes)/d/[organisationSlug]/[siteId]/pages/editor/loading.tsx`:
  route loading state.
- `src/app/(routes)/d/[organisationSlug]/[siteId]/pages/editor/canvas/layout.tsx`
- `src/app/(routes)/d/[organisationSlug]/[siteId]/pages/editor/canvas/page.tsx`:
  isolated canvas route.

Prototype routes under `src/app/(routes)/page-builder-v2-prototype` and
prototype components under `src/components/site-page-builder-v2/prototype`
document the implementation's earlier proving surfaces but are not the
production shell.

## Server lifecycle

Directory: `src/server/page-builder-v2`

- `persistence.ts`: optimistic transaction helpers, durable revisions,
  references, retention and idempotency integration.
- `page-record.ts`: SitePage V2 field mapping.
- `public-version.ts`: published snapshot authority.
- `initial-document.ts`: valid initial draft creation.
- `legacy-migration.ts`: Quizr V1→V2 host cutover conversion.
- `template-catalogue.ts`: Featured + authorised managed catalogue, managed
  CRUD/revision and assignment replacement.

Routers:

- `src/server/api/routers/site-page-v2.ts`: get/update
  autosave/save/publish/unpublish/revisions/restore/saved-block endpoints and
  authorization/activity policy.
- `src/server/api/routers/page-builder-template.ts`: organisation catalogue and
  platform-admin managed-template procedures.
- `src/server/api/routers/media-library.ts`: organisation media
  query/upload/external/trash/restore/delete/rename/reference APIs consumed by
  picker and Media page.

Persistence models live in `prisma/schema.prisma`, notably SitePage V2 fields,
`SitePageRevision`, page/quiz/media references, `PageBuilderTemplate`,
`PageBuilderTemplateAssignment` and media asset/upload models.

## Media UI and service integration

Directory: `src/components/media-library`

- `media-picker.tsx`: policy-driven Add/Gallery dialog and pending-selection
  commit.
- `media-upload-queue.tsx`, `media-upload-store.ts`,
  `media-upload-scheduler.ts`: organisation-scoped resumable session queue.
- `media-gallery-layout.tsx`, `media-masonry.tsx`, `masonry-layout.ts`:
  responsive/virtualized layouts.
- `media-selection.ts`, `media-upload-selection.ts`, `picker-policy.ts`:
  cardinality/order/limit logic.
- `media-viewer.tsx`: accessible full-screen preview/download surface.
- `media-visual.tsx`: image/video/audio/document/unavailable card visuals.
- drop/clipboard helpers and adjacent tests.

The standalone Media page is
`src/app/(routes)/d/[organisationSlug]/media/_components/media-library-workspace.tsx`.

## Product documentation inspected

- `docs/product/archive/page-builder-v2/interaction-spec.md`
- `docs/product/archive/page-builder-v2/plan.md`
- `docs/product/archive/page-builder-v2/cutover-runbook.md`
- `docs/product/archive/page-builder-v2/audits/phase-0.md` through `phase-15.md`
- `docs/product/page-builder-mobile-editor/plan.md`
- `docs/product/media-library-gallery/interaction-spec.md`
- `docs/product/media-library-gallery/plan.md`
- `docs/product/media-library-gallery/storage-lifecycle.md`
- `docs/product/media-library-gallery/operations-runbook.md`
- `docs/product/media-library-gallery/audits/phase-0.md` through `phase-6.md`
- `docs/product/organisation-template-library/plan.md` and its phase audits

## Live observations not to generalize

- The staging document was Project Fit Enquiry and used a 1200px content width,
  1024px tablet maximum and 767px mobile maximum.
- It had three retained durable publish revisions (198 live, 197 and 4).
- Its template variables and page hierarchy are examples of supported depth, not
  default values for every page.
- The live media gallery contained organisation-specific assets;
  filenames/thumbnails are evidence of picker layout only and are not library
  fixtures.

## Dormant, transitional and Host-specific material

- Shared class authoring is implemented but gated off in the current editor.
- Legacy migration and dual SitePage fields exist for Quizr's cutover and are
  not intrinsic to the V2 document model.
- Quiz publication lookup, organisation permissions, billing, tRPC, Prisma, site
  chrome, activity logging, outbox events and media storage are Quizr Host
  integrations around the builder.
- Prototype routes are historical proving tools.
- Current public routing mounts the authored V2 page at Quizr's site root; the
  renderer itself is not a router.

These distinctions are facts for later design work; this research does not yet
decide their treatment in `pagebldr`.
