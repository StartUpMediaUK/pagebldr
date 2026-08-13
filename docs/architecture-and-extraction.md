# Package architecture and extraction plan

The phase-by-phase delivery sequence, including the Fumadocs application and
deployment gates, lives in the
[standalone package plan](plans/standalone-package/plan.md).

## Initial package graph

Publish one consumer package, `pagebldr`, with explicit subpath exports:

```text
pagebldr             configuration, schemas, commands, definitions
pagebldr/react       editor and renderer React modules
pagebldr/styles.css  editor and renderer styles
pagebldr/testing     fixture and extension test helpers
pagebldr/server      optional framework-neutral persistence lifecycle
pagebldr/server/next optional Host-mounted Next.js handler factory
pagebldr/adapters/*  memory and provider-aware Storage adapters
pagebldr/runtime     route resolution and Published page preparation
pagebldr/runtime/next optional Host route/metadata helpers
pagebldr/events      Audit/Analytics contracts and Event sinks
```

Internally, use a pnpm workspace with `packages/core` and `packages/react` only
if the dependency direction is enforced and both are initially bundled into one
published surface. Examples are workspace consumers. This provides locality
without forcing consumers to coordinate versions across multiple public
packages.

```text
packages/core       no React, DOM, Next.js, database, or transport dependencies
packages/react      React renderer/editor; depends on core
packages/server     persistence orchestration; depends on core
packages/adapters   optional database integrations with Provider conformance
packages/runtime    route resolution, publication preparation, event orchestration
examples/vite-basic
examples/nextjs-basic
examples/custom-elements
examples/custom-persistence
```

## Source findings

Quizr V2 already supplies the normalized Document, structural index/invariants,
command mutations, patches/history, clipboard, responsive styles, CSS compiler,
registries, migrations, fixtures, and tests. Its current schema format and
clipboard identifiers are Quizr-named. Its Element registry lacks rendering,
controls, accessibility, and reference extraction, while `runtime.tsx` owns a
central renderer switch. `publish-policy.ts` and `persistence.ts` directly
encode quiz references and revision policy. Those latter modules are Host policy
and must not be copied into core.

The source Quizr checkout was on `feature/product-development` at
`39076f706a760001110018b11db1c079b769a40c`, one commit ahead of origin, with
unrelated uncommitted server work on 2026-08-12. Extraction must use explicit
source hashes and copy only named files; it must never clean or modify that
worktree.

## Extraction phases

### 0. Provenance and fixtures

- Record Quizr source commit and the exact extracted file inventory.
- Copy representative shallow, deep, 500-Element, styles, clipboard, and
  migration fixtures with secrets and product records excluded.
- Establish characterization tests in `pagebldr` before renaming behavior.

### 1. Framework-independent kernel

- Port constants, schemas, types, errors, IDs, document invariants, commands,
  patches, Local history, clipboard, responsive behavior, CSS compilation,
  migrations, and validation.
- Rename public vocabulary and persisted format identifiers at the new seam.
  Create package-native fixtures and do not ship a reader for Quizr's
  application format.
- Delete persistence retention and publish policy from the extraction; replace
  product reference scanning with Element-definition reference extraction.

### 2. Definitions and renderer

- Deepen Element definitions to include render and reference behavior.
- Port standard Elements incrementally and replace the runtime type switch.
- Make assets and links generic Resources. Every Host supplies its own adapters
  through the same public interface; `pagebldr` ships no product-specific
  adapter.
- Prove SSR and deterministic CSS in Vite/React and Next.js fixtures.

### 3. Editor engine and shell

- Port the editor store and operations behind selectors/commands.
- Split large Quizr editor files by responsibility during extraction rather than
  copying application orchestration.
- Replace Quizr tRPC, navigation, saved blocks, revisions, recovery,
  permissions, notifications, and publication with Host callbacks and Resources.
- Replace Quizr-local UI imports with package-owned shadcn primitives and ReUI
  compositions. Compile scoped package CSS so consumers do not require Tailwind
  or registry tooling.

### 4. Composition and integrations

- Implement typed Slots, Contributions, and Presets.
- Prove default and alternate arrangements and custom actions/panels.
- Complete asset, link, custom Element, custom persistence, read-only, and
  preview examples.

### 5. Adoption and release

- Add public-export snapshots, package tarball tests, accessibility/browser
  suites, and React 18/19 compile/runtime matrix.
- Prove that independent Hosts can install a packed prerelease and integrate
  only through documented public extensions. Quizr and Tener adoption occurs
  separately in their repositories.
- Release `alpha`, then `beta`; package version and Document `schemaVersion`
  remain independent.

## Migration policy

- Every persisted Document contains a format identifier and integer schema
  version.
- A package release declares the schema range it can read and the single current
  version it writes.
- Migrations advance exactly one version, are deterministic and side-effect
  free, never access Host resources, and validate after every completed chain.
- Element versions migrate via their Element definition after Document
  migration.
- Future versions, missing steps, duplicate steps, and invalid migrated output
  produce stable errors.
- Compatibility fixtures are immutable once released. Removing a migration
  requires a documented support-window decision and a major package release if
  it breaks supported input.
- No migration occurs implicitly during Host persistence. The Host receives the
  migrated controlled Document and chooses when to save it.

## Verification gates

Each phase requires focused unit tests, TypeScript, lint, formatting, package
`exports` checks, `pnpm pack` consumer installation, and `git diff --check`.
Renderer/editor phases add SSR, browser interaction, axe-based accessibility
checks, keyboard flows, and deep/500-Element performance budgets. The examples
must consume packed artifacts rather than source aliases in release CI.
