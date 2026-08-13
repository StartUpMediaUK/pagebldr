# Source and licence inventory

Status: Phase 0 inventory, 2026-08-13.

## Canonical source pin

- Repository: `https://github.com/joshuag-startupmedia/quizr`
- Branch observed: `feature/product-development`
- Extraction commit: `39076f706a760001110018b11db1c079b769a40c`
- Commit date: 2026-08-12T19:42:33+01:00
- Commit author: `joshuag <joshuag@startupmedia.uk>`
- Commit subject: `feat(platform): complete activity coverage`

The extraction commit exists in the local Quizr object database. Quizr's current
branch has advanced and contains unrelated changes, so extraction reads objects
from this exact commit and never copies from the moving worktree.

## Engine source candidates

The following pinned files are candidates for behavioral characterization and
selective extraction:

```text
src/lib/page-builder-v2/clipboard.ts
src/lib/page-builder-v2/commands.test.ts
src/lib/page-builder-v2/commands.ts
src/lib/page-builder-v2/constants.ts
src/lib/page-builder-v2/css-compiler.ts
src/lib/page-builder-v2/document.test.ts
src/lib/page-builder-v2/document.ts
src/lib/page-builder-v2/engine.test.ts
src/lib/page-builder-v2/errors.ts
src/lib/page-builder-v2/fixtures.ts
src/lib/page-builder-v2/history.ts
src/lib/page-builder-v2/ids.ts
src/lib/page-builder-v2/index.ts
src/lib/page-builder-v2/migrations.ts
src/lib/page-builder-v2/patches.ts
src/lib/page-builder-v2/registries/control-registry.ts
src/lib/page-builder-v2/registries/element-registry.ts
src/lib/page-builder-v2/registries/index.ts
src/lib/page-builder-v2/registries/library-registry.ts
src/lib/page-builder-v2/registries/style-capability-registry.ts
src/lib/page-builder-v2/responsive.ts
src/lib/page-builder-v2/runtime-migrations.test.tsx
src/lib/page-builder-v2/runtime-widgets.tsx
src/lib/page-builder-v2/runtime.tsx
src/lib/page-builder-v2/schema.ts
src/lib/page-builder-v2/templates/core-library.ts
src/lib/page-builder-v2/templates/index.ts
src/lib/page-builder-v2/types.ts
src/lib/page-builder-v2/validation.ts
```

`api-schema.ts` may inform Host transport examples but is not copied into core
because the public package defines a new transport-neutral interface.

## Editor source candidates

The following pinned areas are candidates for behavioral characterization and
responsibility-focused extraction:

```text
src/components/site-page-builder-v2/controls/
src/components/site-page-builder-v2/editor/class-manager-panel.tsx
src/components/site-page-builder-v2/editor/editor-canvas.tsx
src/components/site-page-builder-v2/editor/editor-operations.test.ts
src/components/site-page-builder-v2/editor/editor-operations.ts
src/components/site-page-builder-v2/editor/editor-panel.tsx
src/components/site-page-builder-v2/editor/editor-shell.tsx
src/components/site-page-builder-v2/editor/editor-store.test.ts
src/components/site-page-builder-v2/editor/editor-store.ts
src/components/site-page-builder-v2/editor/editor-structure.tsx
src/components/site-page-builder-v2/editor/editor-style-panel.tsx
src/components/site-page-builder-v2/editor/element-general-controls.tsx
src/components/site-page-builder-v2/editor/page-design-dialog.tsx
src/components/site-page-builder-v2/editor/variable-manager-panel.tsx
```

The prototype directory may supply interaction fixtures but is not a package
architecture. `editor-workspace.tsx`, `editor-bridge.ts`, recovery, and
history-sheet code require per-responsibility review because they mix reusable
behavior with Quizr orchestration.

## Explicit exclusions

The following pinned modules are not extraction candidates:

```text
src/lib/page-builder-v2/persistence.ts
src/lib/page-builder-v2/persistence.test.ts
src/lib/page-builder-v2/publish-policy.ts
src/lib/page-builder-v2/publish-policy.test.ts
src/lib/page-builder-v2/api-schema.ts (implementation)
src/server/page-builder-v2/
src/server/api/routers/site-page-v2.ts
```

Also excluded are Quizr identifiers and clipboard formats, quiz Resource
semantics, tRPC/Prisma/application routing, permissions, tenant/site policy,
notifications, analytics, publication records, saved Blocks, assets, and local
UI imports. `pagebldr` creates neutral formats, server contracts, Runtime,
events, and Storage adapters.

## Product references

The pinned Quizr plan, interaction specification, cutover runbook, and phase 0–7
audits are design evidence only. They are not copied into the public package
documentation.

## Licence status

No `LICENSE`, `COPYING`, or `NOTICE` file was found in the pinned Quizr
repository tree. Repository access and shared ownership do not establish
permission to publish copied or derivative source under a new open-source
licence.

On 2026-08-13, the product owner confirmed that Startup Media owns the Quizr
builder implementation in its private SaaS repository and authorizes extraction
and open-source relicensing under MIT. Any contributor or third-party source
with separate terms must still be identified and handled before copying.

For new dependencies and vendored source:

- record package name, version, source URL, licence, and whether code/assets are
  redistributed;
- preserve required notices and attribution;
- inspect every shadcn primitive and ReUI composition when added rather than
  approving an entire registry in advance;
- exclude fonts, images, icons, demo content, and fixtures without verified
  redistribution rights;
- run an automated dependency-licence inventory in CI, backed by manual review
  for vendored source.
