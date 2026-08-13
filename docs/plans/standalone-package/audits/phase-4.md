# Phase 4 audit — editing engine

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The framework-independent editing engine is implemented behind `builder.editor`.
All exposed editing behavior returns new validated Documents; the
Host-controlled input is never mutated. Save, autosave, publication, optimistic
concurrency, and durable Revisions remain outside the engine.

The engine contains no React, DOM, database, transport, or product-specific
imports. UI and keyboard integrations can query the same `can` and selector
interface before dispatching commands.

## Changed interfaces

`builder.editor` now provides:

- `dispatch` for one validated semantic command;
- `dispatchMany` for atomic multi-command transactions;
- bounded Local history with commit, coalescing, undo, redo, branch clearing,
  and patch/inverse-patch round trips;
- subtree clipboard creation and collision-safe Element/reference remapping;
- command availability plus Element and history selectors.

Commands cover Element insertion, movement, duplication, removal, names,
properties, styles, lock, and visibility; Class and Variable creation,
assignment, ordering, updates, forced cleanup, and deletion; and Document
metadata/settings. Transactions expose semantic labels, command types, changed
Element IDs, and forward/inverse patches. `DocumentChangeEvent` is now shared by
core and the controlled React editor contract.

Patch application, mutable working copies, traversal, clipboard remapping, and
validation orchestration remain implementation details. Public Documents and
Elements stay readonly.

## Source extraction

Behavior was characterized against the explicitly pinned Startup Media-owned
source commit `39076f706a760001110018b11db1c079b769a40c`, specifically commands,
patches, Local history, clipboard, IDs, validation, and tests. Persisted
clipboard identity is package-native (`pagebldr-clipboard`); no Host format or
compatibility path is shipped.

## Verification performed

- Success and refusal behavior across every exposed command family.
- Root-operation, circular-move, locked-content, invalid-index, missing-record,
  duplicate-ID, in-use Class/Variable, and no-op refusal paths.
- Forward/inverse patch undo/redo, bounded history, coalescing windows, history
  branching, and future clearing.
- Atomic transaction rollback without input mutation.
- Clipboard subtree duplication with collision-free IDs and internal Element
  reference remapping.
- Shared command availability and history selectors.
- Deterministic 100-command sequences and 50 property-generated command
  sequences, validating the Document after every sequence.
- A public-interface edit against the immutable 500-Element fixture within the
  focused performance guardrail.
- Focused core tests plus the complete repository formatting, lint, TypeScript,
  test, build, package-analysis, packed-consumer, licence, and diff gates.

## Deferred work and risks

- Element child policies become enforceable when the complete Element definition
  module lands in its planned phase; structural tree invariants are already
  enforced here.
- Style capability/property compatibility belongs to the CSS and definition
  phases; commands currently preserve schema-safe responsive style values.
- Local history is deliberately in-memory and is not a durable Revision log.
- Clipboard payload parsing from untrusted external text will be added alongside
  the public clipboard integration surface; current clipboard values originate
  from the typed engine.
- No publication, deployment, push, or other external-system change occurred.

## Commit

To be recorded after product-owner review and authorization.
