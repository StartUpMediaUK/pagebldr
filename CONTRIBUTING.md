# Contributing to pagebldr

Read [AGENTS.md](AGENTS.md) for package boundaries and change constraints. User
guides and integration examples live in [apps/docs](apps/docs).

## Development

Use Node.js 20.19 or newer and pnpm 10.8.0 through Corepack:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @pagebldr-example/vite-basic dev
```

The Vite example is the Reference Host for the installed default experience. Use
public package exports and compiled package styles in consumer examples.

## Scope and verification

Keep each contribution focused on one problem. Discuss substantial features,
architectural changes and compatibility changes with maintainers before
implementation. Include the relevant tests and user documentation with the
behavior they govern. Add a Changeset for user-visible or public-interface
changes to the published package.

Run focused tests during development. Before handing over a change, run the
applicable tests, TypeScript, lint, formatting and build checks. `pnpm check`
runs the repository gates, including packed-consumer and export checks. Run
`git diff --check` as well. Public API changes require review of declarations
and compatibility. See [RELEASING.md](RELEASING.md) for release-specific checks.

UI changes require real-browser verification, keyboard-only review and
accessibility checks on the states revealed by interaction. Release verification
covers packed consumers under supported React majors, Vite and Next.js.

## Pull requests

Explain the problem, resulting behavior, verification commands and results, and
material risks or checks that could not run. Attach before/after captures for
visual changes and a short recording when needed to demonstrate interaction.
Keep PR-only captures and generated reports in attachments or CI artifacts.

Keep implementation plans, research, owner notes and agent scratch material
local. Do not make contributions depend on files absent from a fresh clone.

Preserve the project licence, copyright headers, third-party notices and
registry provenance. Include required attribution when moving or deriving code.
Never include credentials, private Host data or unlicensed assets and source.
