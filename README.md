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

The Vite application is the Reference Host: the canonical browser surface for
auditing the complete installed Default experience, controlled editing and
production rendering without a database or external account. Acceptance checks
run it against a freshly packed package artifact using public exports and the
package stylesheet. Public guides live in `apps/docs`.

## Documentation and contributing

- [User guides and integration examples](apps/docs/content/docs)
- [Contributing](CONTRIBUTING.md)
- [Agent guidance](AGENTS.md)
- [Domain language](CONTEXT.md)
- [Public interface](docs/public-interface.md)
- [Editor composition](docs/editor-composition.md)
- [Release procedures](RELEASING.md)
- [UI attribution](docs/attributions/ui.md)
