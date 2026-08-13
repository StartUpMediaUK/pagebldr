# Phase 1 audit — repository and quality scaffold

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The repository is now a reproducible pnpm/Turborepo workspace with one
publishable `pagebldr` aggregation package, private internal modules, reserved
private docs/example workspaces, strict shared TypeScript and ESLint settings,
formatting, Vitest, Changesets, package checks, CI, and contributor/security
policies. No runtime, editor, server, adapter, docs application, or example
behavior was implemented ahead of its plan phase.

## Workspace changes

- Root: pnpm 10.8.0, Node `>=20.19.0`, Turborepo, TypeScript 5.9, ESLint 9,
  Prettier, Vitest, Publint, Are the Types Wrong, Changesets, and pnpm licence
  inventory.
- Private modules: `@pagebldr/core`, `@pagebldr/react`, `@pagebldr/server`,
  `@pagebldr/runtime`, and `@pagebldr/adapters`.
- Published module: `pagebldr`, initially ESM-only with an intentionally empty
  export surface until the Phase 2 tracer.
- Reserved private workspaces: Fumadocs application and four examples. They
  contain no fake build/test scripts before their implementation phases.
- CI: clean frozen install and `pnpm check` on Node 20.19 and Node 22.

## Package safeguards

- `pagebldr` is the only non-private workspace package.
- `publishConfig.access` is public and provenance is requested for eventual
  authorized publication.
- Publint and the ESM-only Are the Types Wrong profile inspect the packed
  artifact.
- An isolated temporary consumer installs the tarball and imports `pagebldr`.
- Example and docs manifests are private and cannot be recursively published.
- The package tarball includes its own MIT licence and README.

## Policies and contributor experience

- Added contribution, security, support, and conduct policies plus a pull
  request template.
- Added repository ignore, editor, npm, formatting, TypeScript, lint, task, and
  Changesets configuration.
- Dependency licences are inventoried through pnpm as part of `pnpm check`;
  vendored shadcn/ReUI source still requires item-level review when introduced.

## Verification performed

- `pnpm install --frozen-lockfile=false` to establish the initial lockfile.
- `pnpm format:check`.
- `pnpm lint`.
- `pnpm typecheck` across implemented package workspaces.
- `pnpm test`; package workspaces intentionally pass with no tests before
  behavior exists.
- `pnpm build` for all implemented package workspaces.
- Publint and Are the Types Wrong using the declared ESM-only profile.
- Isolated tarball installation/import.
- pnpm dependency-licence inventory.
- Markdown local-link validation and `git diff --check`.

## Checks not yet run

- GitHub Actions cannot be observed until changes are committed and pushed; no
  push is authorized by this phase.
- The Node 20/22 matrix is configured in CI but local checks ran on Node 26.7.
- Browser, accessibility, React-version, and database checks begin in their
  applicable phases.

## Risks and deferred work

- ESM-only packaging is deliberate; CommonJS `require()` is unsupported.
- The public package is structurally valid but intentionally exports no behavior
  until Phase 2.
- The duplicated package-local licence must stay byte-equivalent to the root
  licence until the build/release pipeline automates package assembly.
- npm naming remains unreserved and no release workflow publishes packages.

## Commit

Included with this audited repository scaffold commit after product-owner
approval.
