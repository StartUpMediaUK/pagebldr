# Contributing to pagebldr

Thank you for helping build `pagebldr`. Read [AGENTS.md](AGENTS.md), the
[product specification](docs/product-specification.md), and the active
[standalone package plan](docs/plans/standalone-package/plan.md) before making
substantial changes.

## Development

Requirements:

- Node.js 20.19 or newer
- pnpm 10.8.0 through Corepack

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Keep changes scoped to one plan phase. Add tests at the public module interface
and a Changeset for user-visible or public-interface changes to the published
package. Phase work also updates its audit under
`docs/plans/standalone-package/audits/`.

## Pull requests

Explain the outcome, verification performed, risks, and deferred work. UI
changes require real-browser and keyboard/accessibility verification. Never
include credentials, private Quizr/Tener data, or unlicensed assets and source.
