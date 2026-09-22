# Quizr Page Builder V2 source-of-truth study

Status: evidence capture complete; implementation and adoption planning are
intentionally out of scope

Observed: 22 September 2026

Quizr source commit: `7dec26465c454b25545664e84d8e1e91b97ae9d1`

Staging surface:
`https://staging.app.quizr.startupmedia.uk/d/acme-inc/brand-awareness/pages/editor`

## Purpose

This folder records how Quizr Page Builder V2 actually behaves today. It is a
descriptive baseline, not a proposal for `pagebldr`, a compatibility plan, or an
implementation checklist.

The study combines three kinds of evidence:

1. the authenticated Quizr staging editor, inspected without changing or
   publishing its document;
2. the pinned Quizr implementation, including the engine, editor, persistence,
   runtime, template and media integrations; and
3. Quizr's completed interaction specifications and phase audits.

When the sources differ, this documentation says so. Live staging is the
authority for exposed interaction and visual behaviour. The pinned code is the
authority for data, command, validation, persistence and runtime behaviour that
cannot be proven from the UI alone. Product documents supply intent and required
edge states.

## What Quizr's page builder is

Quizr Page Builder V2 is a normalized, command-driven page document editor with:

- a desktop and narrow-screen authoring shell;
- a shared renderer used by editor preview, revision preview and the public
  page;
- 24 registered element types;
- responsive, stateful styling with variables and an underlying class model;
- reusable repository blocks, saved site blocks, featured templates and
  organisation-assigned managed templates;
- shared media-library selection for images, video, galleries and social images;
- local undo/redo history distinct from durable save/publish/restore revisions;
- optimistic autosave, explicit draft saves, publication, unpublication,
  conflict recovery and local recovery data; and
- a public runtime that resolves assets, quizzes, links, interactive widgets and
  page metadata from the published document.

The designed page is not stored as HTML. The source of truth is a versioned JSON
document. Rendering and CSS are derived from that document.

## Documentation map

- [Editor experience](01-editor-experience.md) — shell anatomy, canvas,
  Structure, inspectors, preview, responsiveness, keyboard interaction and
  read-only/error states.
- [Document engine and styling](02-document-engine-and-styling.md) — schema,
  invariants, commands, history, clipboard, cascade, variables, classes, CSS
  compilation and migrations.
- [Elements, blocks and templates](03-elements-blocks-and-templates.md) — all
  registered content types and every live library item.
- [Media and runtime](04-media-and-runtime.md) — picker, media accessibility,
  renderer behaviour, interactive widgets, public routing and metadata.
- [Persistence, history and publication](05-persistence-history-and-publication.md)
  — autosave, explicit save, revisions, publish, restore, unpublish, conflicts
  and recovery.
- [Evidence and source inventory](06-evidence-and-source-inventory.md) — pinned
  paths, evidence classification and observed limitations.

## Screenshot index

The screenshots are evidence from the authenticated staging editor. No content
was inserted, edited, saved, restored, published or unpublished while capturing
them.

| Evidence                                                                   | What it shows                                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Editor anatomy](screenshots/01-editor-anatomy-elements-and-structure.png) | Desktop toolbar, element library, fixed-width canvas, Structure window and zoom island. |
| [Block library](screenshots/02-block-library.png)                          | Block cards, thumbnail treatment and Insert block action.                               |
| [Template library](screenshots/03-template-library.png)                    | Featured/My templates, category filter, favourite and preview affordances.              |
| [Content inspector](screenshots/04-heading-content-inspector.png)          | Selection outline, synchronized Structure selection and Heading content controls.       |
| [Style inspector](screenshots/05-container-style-inspector.png)            | Normal/Hover/Focus states, active breakpoint, Typography and Background controls.       |
| [Advanced inspector](screenshots/06-container-advanced-inspector.png)      | Anchor ID, Layout and Size controls on the selected container.                          |
| [Media gallery picker](screenshots/08-media-gallery-picker.png)            | Add/Gallery dialog, query controls, masonry cards and commit-only footer.               |
| [Page variables](screenshots/09-page-design-variables.png)                 | Page-design dialog and ordered variables with values and usage counts.                  |
| [Durable revisions](screenshots/10-history-revisions.png)                  | History sheet, revision metadata, live marker, preview and restore actions.             |

## Important distinctions

- **Authored breakpoint is not browser width.** Desktop/Tablet/Mobile in the
  toolbar selects which responsive declarations are authored and which canvas
  width is simulated. The editor shell also has its own responsive presentation
  at 1024 and 768 pixels.
- **Actions are not Revisions.** Actions are local command history for the
  current editor session. Revisions are durable server records created only by
  explicit Save draft, Publish and Restore.
- **Autosave is not Save draft.** Autosave updates the current draft head and
  revision counter but does not add a durable Revision card.
- **Preview is not publication.** Preview renders the current local document
  with editor navigation disabled. The public runtime renders only the published
  document.
- **Blocks and templates are not special runtime nodes.** They materialize
  ordinary editable element trees. Applying a template replaces the page's
  editable design while preserving page identity and selected page metadata.
- **Classes exist but are not currently exposed.** The document, command engine,
  CSS compiler and class manager support shared style classes. In the pinned
  editor, class assignment is gated off by
  `SHOW_PAGE_BUILDER_V2_CLASS_CONTROLS = false`; staging therefore exposes
  variable-driven styling but not class management as a user feature.
- **Media assets are references.** Page documents store managed asset IDs and
  per-usage accessibility/caption data. Quizr's media service owns files,
  availability, metadata, thumbnails and delivery.

## Deliberate exclusions

This research does not decide what must be copied, renamed, generalized or
excluded from `pagebldr`. It does not change the product specification, create
an adoption sequence, or implement any behaviour. Those decisions require a
separate planning step after this baseline is reviewed.
