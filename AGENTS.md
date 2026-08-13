# pagebldr working agreement

## Start here

1. Read this file before changing the repository.
2. Inspect the worktree and preserve unrelated or pre-existing changes.
3. Read [the product specification](docs/product-specification.md),
   [domain language](CONTEXT.md), and the specification relevant to the task
   before designing or implementing behavior.
4. Inspect the skills available in the current runtime. Use the shadcn and ReUI
   skills for editor UI work when available; if a required skill is unavailable,
   report that fact and follow the repository rules below without pretending the
   skill ran.
5. Follow [the standalone package plan](docs/plans/standalone-package/plan.md)
   one phase at a time. Write its audit under
   `docs/plans/standalone-package/audits/`, complete the phase gate, and obtain
   product-owner review before beginning the next phase.

## Product seam

- Build a standalone package for ordinary installation by any React Host. Keep
  Quizr, Tener, and every other product outside package code and public
  vocabulary.
- The package owns Documents, validation, migrations, commands, Local history,
  registries, editor behavior, rendering, compiled package styles, and optional
  server-side Document lifecycle orchestration.
- The optional server module owns adapter-neutral save correctness, optimistic
  concurrency, Revisions, restoration, publication state, and package event
  emission. The Host owns authentication, authorization, scope resolution, API
  runtime/load, deployment, Resources, navigation, notifications, Event
  sinks/retention/access, and whether the optional modules are used.
- Every Storage adapter declares its integration and concrete Provider/dialect.
  Implement and test provider capabilities explicitly; never infer that two
  Providers supported by one ORM have equivalent transactions, JSON behavior,
  identifiers, indexes, or relation semantics.
- Keep HTTP endpoints and server actions in the Host. Framework modules may
  create handlers that a Host mounts, but `pagebldr` runs no central API and
  bears no traffic, compute, rate limiting, authentication, or deployment
  responsibility.
- Emit schema-versioned Audit events for editor/server actions and Analytics
  events for published Visits and Interactions. Keep their contracts distinct:
  Audit events are durable and mutation-associated; Analytics events are
  consent-aware and batchable.
- Send events only through Host-configured Event sinks. Provide safe
  memory/callback/console development sinks and optional
  storage/OpenTelemetry-style integrations, while the Host owns retention,
  querying, export, privacy, consent, and operational cost.
- Express Host variation through the same documented callbacks, Resource
  adapters, Element definitions, and Contributions available to every consumer.
  Product-named adapters and privileged integration paths are out of scope.
- Keep the editor controlled. `onChange` changes Host state; `onSave` and
  `onPublish` signal Host intent. Local history never represents durable
  Revisions.
- Blocks and Templates create ordinary editable Element trees. Element
  definitions keep schema, defaults, child policy, styles, migrations, controls,
  rendering, accessibility, and reference extraction coherent.

## Architecture

- Preserve the normalized Document model and command-only mutation invariant
  from the source implementation while adopting neutral `pagebldr` names and
  formats at the new seam.
- Keep `packages/core` free of React, DOM, Next.js, databases, transports, and
  product policy. `packages/react` may depend on core; core never depends on
  React.
- Export one consumer package with deliberate subpaths. Treat internal
  registries, stores, DOM structure, and CSS implementation classes as private.
- Maintain SSR-safe renderer paths. Put browser-dependent editor code behind
  explicit client entry points without making the package Next.js-specific.
- Add a seam only when behavior genuinely varies. Prefer deep modules that hide
  orchestration and expose small, testable interfaces.
- Keep `pagebldr/server` framework-neutral. Framework handler factories such as
  `pagebldr/server/next` adapt Host requests to it without owning deployment or
  authorization policy.
- Keep `pagebldr/runtime` framework-neutral: resolve published Documents by Host
  path/scope, prepare Resources and metadata, and produce Published pages.
  Framework route modules adapt Host routing to the Runtime; they do not own
  application routes.
- Treat `PagebldrRenderer` as presentation only. Route resolution, publication
  lookup, metadata, cache identity, and Visit/Interaction collection belong to
  the Runtime module.
- Keep package version and Document `schemaVersion` independent. Migrations are
  deterministic, sequential, side-effect free, and verified with immutable
  fixtures.

## UI implementation

- Use shadcn source components as the editor UI foundation and ReUI registry
  components as the preferred higher-level composition source. Components are
  package-owned source after installation; consumers do not install shadcn or
  ReUI.
- Before creating UI, inspect configured registries and existing components.
  Prefer an existing shadcn primitive, then an appropriate ReUI composition,
  then a small package-owned composition.
- Use the project's package runner for the shadcn CLI. Obtain current component
  documentation before using a component, and inspect every file added from a
  registry.
- Keep registry provenance in component documentation or the repository's
  attribution record where required. Review dependencies, licenses, imports,
  accessibility, and styling before accepting registry code.
- Compile and ship the editor's CSS. Hosts import `pagebldr/styles.css` and
  theme documented custom properties; they do not need Tailwind, a shadcn
  configuration, or access to internal utility classes.
- Use semantic theme tokens and component variants. Use `className` for layout,
  `gap-*` for spacing, `size-*` for equal dimensions, and `cn()` for conditional
  classes.
- Compose accessible primitives: titled dialogs/sheets/drawers, grouped
  menu/select/command items, `FieldGroup` and `Field` forms, labeled controls,
  visible focus, keyboard alternatives for pointer interactions, and
  reduced-motion behavior.
- Use the configured icon library. Pass icon components rather than string keys;
  icons inside buttons use `data-icon` and component-owned sizing.
- Contributions receive public selectors and command dispatch, never the
  internal editor store.

## Source extraction

- Treat Quizr Page Builder V2 as source material, not a compatibility target.
  Copy only explicitly inventoried engine/editor behavior from the pinned source
  commit and do not modify or clean the Quizr worktree.
- Exclude Quizr persistence, tRPC, publication, revisions, permissions,
  navigation, notifications, assets, quiz references, product schemas, and
  product naming.
- Write neutral characterization tests before changing extracted behavior.
  Create package-native fixtures; do not preserve Quizr format identifiers or
  ship Quizr migration/adoption code in `pagebldr`.

## Verification and completion

- Add or update tests at the public module interface. Cover invalid documents,
  migration failures, command invariants, renderer output, keyboard interaction,
  and extension behavior relevant to each change.
- Test event schema/versioning, redaction, ordering, deduplication IDs,
  transactional Audit behavior, consent gating, batching/retry limits, and
  Runtime route resolution.
- Run focused tests during development, then proportional repository gates:
  tests, TypeScript, lint, formatting, build, package export checks,
  packed-consumer tests, and `git diff --check`.
- For UI changes, verify representative flows in a real browser and run
  accessibility checks on states revealed by interaction. Include keyboard-only
  review; automated accessibility results are not sufficient alone.
- Test supported React majors and both Vite and Next.js using packed artifacts
  before release work.
- Report every check performed and every check that could not run. Commit,
  publish, push, create repositories, or alter external systems only when
  explicitly authorized.

## Documentation

- Build the public documentation application in `apps/docs` with Next.js App
  Router and Fumadocs. Keep it a private workspace consumer and deploy it
  independently from the package.
- Generate human-readable guides, search, `llms.txt`, `llms-full.txt`, and
  per-page Markdown from one MDX source. Keep documented examples
  compile-checked against public package exports.
- Update `CONTEXT.md` when stable domain language changes; keep implementation
  details out of it.
- Update public-interface, composition, migration, and integration documentation
  with the behavior they govern.
- Record an ADR only for a hard-to-reverse, surprising decision made through a
  real trade-off.
- Keep examples product-neutral. A Quizr or Tener adoption belongs in that Host
  repository, using only the same package interface available to third parties.
- At phase completion, write `docs/plans/standalone-package/audits/phase-<n>.md`
  with outcome, changed interfaces, verification, deferred work, risks, and
  commit when available.
