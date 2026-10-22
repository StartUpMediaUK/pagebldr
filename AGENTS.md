# Working on pagebldr

pagebldr is an embeddable visual page builder for React Hosts. It ships a
complete styled editor, a portable Document model, a renderer, and optional
server lifecycle, Storage adapters, Runtime and event modules. Hosts own routes,
authentication, authorization, deployment, Resources and operational policy.

## Start here

1. Inspect the worktree and preserve unrelated changes.
2. Read [README.md](README.md) for the product and development entry points and
   [CONTRIBUTING.md](CONTRIBUTING.md) before preparing a contribution.
3. Read [CONTEXT.md](CONTEXT.md) when changing domain behavior or terminology.
   For public interfaces, read
   [docs/public-interface.md](docs/public-interface.md); for editor extensions,
   read [docs/editor-composition.md](docs/editor-composition.md).
4. Inspect the relevant implementation, tests and package scripts before
   editing. Follow any additional AGENTS.md in the directory being changed.

## Package boundaries

- Keep the package product-neutral. Host integrations use the same public
  callbacks, Resource adapters, Element definitions and Contributions available
  to every consumer.
- Keep `packages/core` independent of React, DOM, frameworks, databases and
  transports. React modules depend on core; core never depends on React.
- Export one consumer package with deliberate subpaths. Internal registries,
  stores, DOM structure and CSS implementation classes remain private.
- Keep the editor controlled: `onChange` updates Host state; `onSave` and
  `onPublish` signal intent. Local history is separate from durable Revisions.
- Preserve normalized Documents and command-only mutations. Blocks and Templates
  create ordinary editable Element trees. Keep each Element definition's schema,
  defaults, children, controls, rendering, styles and migrations coherent.
- Keep package version and Document schemaVersion independent. Migrations are
  deterministic, sequential and side-effect free, with immutable fixtures.
- Keep renderer imports SSR-safe and browser editor code behind client entries.
  The Runtime owns route resolution, publication lookup, metadata and
  collection; PagebldrRenderer owns presentation.
- Keep server and Runtime modules framework-neutral. Hosts mount handlers and
  routes and supply authorization, scope, storage and Event sinks.
- Verify each Storage adapter's concrete Provider independently. Refuse
  unsupported transaction or concurrency guarantees explicitly.
- Keep durable Audit and consent-aware Analytics contracts distinct. Emit events
  only through Host-configured sinks; redact authored content and credentials.

## Editor UI

- Inspect existing components and configured registries first. Use package-owned
  shadcn primitives, suitable ReUI compositions, then small local compositions.
  Check current component documentation and review installed registry source.
- Preserve registry provenance and required notices. Ship compiled package CSS;
  consumers import `pagebldr/styles.css` without configuring Tailwind or
  registries.
- Use semantic theme tokens, component variants and accessible primitives. Label
  controls, title dialogs, preserve visible focus, support reduced motion and
  provide keyboard alternatives for pointer interactions.
- Contributions use public selectors and command dispatch rather than the
  internal editor store. Validate the default UI through the packed Reference
  Host without Host styling that hides package defects.

## Verification and documentation

- Test observable behavior through public module interfaces. Cover the affected
  invariants, errors and extension seams; use real Providers for adapter claims.
- Run focused checks while developing, then the proportional gates in
  CONTRIBUTING.md. Report commands, results and anything that could not run.
- Verify UI changes in a real browser, including interaction-revealed states,
  keyboard-only use and accessibility. Automated checks alone are insufficient.
- Update guides when usage changes and migration guidance when compatibility
  changes. Public docs live in `apps/docs`; use public exports in examples.
- Keep durable architectural reasons and constraints in shared documentation.
  Keep implementation plans, research, owner notes, agent scratch files and
  generated reports local. PR evidence belongs in PR attachments or CI
  artifacts.

## Attribution and repository safety

- Preserve LICENSE, copyright headers, third-party notices and source
  attribution. Do not remove or replace attribution to simplify a change or
  claim sole authorship. Carry required notices forward when moving or deriving
  source.
- Review dependency and registry licences before adding code. Keep attribution
  records and the published THIRD_PARTY_NOTICES.md accurate.
- Keep credentials, private Host data and unlicensed assets out of commits.
- Commit, push, publish, deploy or rewrite shared history only when explicitly
  authorized. Preserve unrelated work and create a recoverable backup before
  destructive Git operations. See RELEASING.md for release procedures.
