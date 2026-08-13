# Phase 3 audit — Document kernel

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The framework-independent Document kernel is implemented behind
`builder.documents`. It preserves the pinned source implementation's normalized
Element tree, ordered Classes and Variables, responsive styles, root ownership,
one-parent invariant, structural index, validation, and sequential migration
behavior while using package-native `pagebldr` vocabulary and formats.

The kernel contains no React, DOM, Next.js, database, transport, product policy,
or product-specific identifiers. No compatibility reader or migration for a Host
application's prior format was added.

## Changed interfaces

`builder.documents` now provides a deep module interface for:

- Document creation, parsing, validation, cloning, serialization, and
  deserialization;
- deterministic Document-schema and Element-version migrations;
- structural indexes containing parents, sibling indexes, depths, descendants,
  and preorder traversal.

The root package exports package-native Document, Element, Class, Variable,
responsive-style, migration, validation-result, ID-factory, and structural-limit
types/constants. Migration maps, schema implementation, traversal state, and
validation orchestration remain private implementation details.

## Source extraction

Behavior was characterized against the explicitly pinned Startup Media-owned
source commit `39076f706a760001110018b11db1c079b769a40c`, specifically its
constants, IDs, schemas/types, Document indexing, validation, migrations, and
errors. The implementation was neutralized rather than copied as a compatibility
surface. Fixtures use only package-native values and contain no Host records or
product format identifiers.

## Verification performed

- Creation and schema validation with stable coded errors.
- Clone independence, canonical serialization, deserialization, and round-trip
  stability.
- Record-key/ID correspondence and exact ordered Class/Variable coverage.
- Root existence, missing children, cycles, multiple parents, duplicate
  children, orphans, broken Class/Variable references, and invalid IDs.
- Unknown Element definitions, structural element limits, future schemas,
  missing migration steps, and future Element versions.
- Deterministic, sequential, input-immutable Document and Element migrations,
  including current-version idempotence.
- Immutable shallow, deep, invalid, and 500-Element package-native fixtures; the
  500-Element fixture is indexed through the public module interface.
- Focused core tests, repository TypeScript, lint, all tests, build, package
  analysis, and packed-consumer compilation.

## Deferred work and risks

- Command mutations and Local history begin in Phase 4; the kernel itself does
  not mutate Documents.
- Style-property capability validation belongs with the later style and Element
  definition phases; this phase validates responsive value structure and
  Variable existence.
- The current schema version is 1, so the tested 0-to-1 migration is a
  package-native fixture proving the chain rather than a shipped historical
  compatibility migration.
- The core bundle currently includes its schema validator implementation. Bundle
  splitting and size budgets remain release-hardening work after the public
  behavior stabilizes.
- No publication, deployment, push, or other external-system change occurred.

## Commit

To be recorded after product-owner review and authorization.
