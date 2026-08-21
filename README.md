# pagebldr

`pagebldr` is an embeddable visual page-building engine for React applications.
It provides a schema-versioned document model, command engine, controlled visual
editor, production renderer, optional server lifecycle, and published-page
Runtime. The Host owns persistence choice, routes, authorization, resources,
deployment, and surrounding product UX.

Licensed under the [MIT License](LICENSE).

The package is in pre-release development. Public alpha interfaces may change
with a Changeset and documented migration guidance.

The editor UI is built from package-owned shadcn primitives and ReUI
compositions. Consumers import compiled styles and do not install either UI
system.

## Try it locally

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @pagebldr-example/vite-basic dev
```

The Vite example demonstrates controlled editing and production rendering
without a database or external account. Public guides live in `apps/docs`.

## Current documents

- [Product specification](docs/product-specification.md)
- [Public interface proposal](docs/public-interface.md)
- [Editor composition proposal](docs/editor-composition.md)
- [Package architecture and extraction plan](docs/architecture-and-extraction.md)
- [Open owner decisions](docs/owner-decisions.md)
- [Startup Media repository audit](docs/startup-media-audit.md)
- [Package and release research](docs/research/package-and-release-foundations.md)
- [Standalone package plan](docs/plans/standalone-package/plan.md)
- [Source and licence inventory](docs/plans/standalone-package/source-and-license-inventory.md)
