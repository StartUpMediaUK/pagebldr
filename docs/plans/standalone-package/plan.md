# Standalone package plan

Status: proposed for approval. This plan covers the standalone package,
examples, Fumadocs site, quality system, prerelease pipeline, and later Host
adoption. Startup Media repository repair remains a separate plan.

Phase audits live in [`audits/`](audits/) as `phase-<n>.md`. Complete and review
an audit before starting the next phase.

## Outcome

Deliver one installable package, `pagebldr`, containing a framework-independent
engine plus React editor and renderer; four product-neutral examples; a Fumadocs
documentation application deployed independently; and a trusted prerelease
pipeline. Quizr, Tener, and other Hosts adopt the package afterward through the
same public interface.

## Target repository

```text
pagebldr/
  apps/
    docs/                    Next.js 16 + Fumadocs documentation site
  packages/
    core/                    framework-independent implementation
    react/                   editor, renderer, shadcn/ReUI source, CSS
  examples/
    vite-basic/
    nextjs-basic/
    custom-elements/
    custom-persistence/
  fixtures/
    documents/
    migrations/
    performance/
  docs/                      project specifications and ADRs
  .changeset/
  .github/workflows/
```

Only one library is published. Workspace modules are assembled behind these
consumer exports:

```text
pagebldr
pagebldr/react
pagebldr/styles.css
pagebldr/testing
```

The docs application and examples are private workspace consumers and never
published.

## Delivery rules

- Implement one phase at a time. Finish its verification and audit before
  starting the next phase.
- Freeze public names only after compile-tested usage proves inference, error
  behavior, and tree-shaking.
- Test through public module interfaces. Internal registries and stores are
  replaceable implementation details.
- Use package-native formats and fixtures. Source extraction carries behavior,
  not Quizr identity or compatibility code.
- Keep external writes—GitHub creation, Vercel project creation, npm publishing,
  and domain changes—behind explicit authorization gates.
- Use prerelease versions and non-`latest` dist-tags until beta exit criteria
  pass.

## Persistence and transport architecture

`pagebldr` has no required backend, but it includes an optional
framework-neutral server module so Hosts do not repeatedly implement save
correctness. Callback-only/local-first use remains valid. The server module
standardizes Document loading, validation/migration, saving, optimistic
concurrency, Revisions, restoration, and publication state through Storage
adapters.

Every Storage adapter declares both its integration and its concrete
Provider/dialect. `prisma + mongodb` and `prisma + postgresql` are distinct
conformance targets because transaction guarantees, JSON representation,
identifiers, indexes, and relation behavior differ. Provider selection is
mandatory, capabilities are reported explicitly, and unsupported lifecycle
guarantees fail during construction rather than degrading silently.

Initial targets are:

1. `memory`, for tests, examples, and adapter conformance;
2. `prisma`, with separately tested `mongodb` and `postgresql` Providers first;
3. `drizzle`, with each supported SQL dialect named and tested separately rather
   than claiming universal Drizzle support.

Hosted products normally select their underlying tested Provider: Neon or
Supabase backed by PostgreSQL uses the tested PostgreSQL path unless a genuine
provider-specific difference requires another implementation. Firebase and other
non-SQL/document stores wait until the storage contract is proven and their
guarantees can be stated honestly.

The application bears all API load. The repository deploys no central `apps/api`
service. `pagebldr/server/next` may provide an optional handler factory mounted
at a Host-owned route such as `app/api/pagebldr/[...all]/route.ts`; the Host
owns its runtime, authentication, authorization, scope resolution, rate
limiting, observability, scaling, and cost. Direct server calls, Server Actions,
REST, GraphQL, and tRPC remain supported.

Single-page and multi-page are Collection policies over one storage model.
`single` constrains operations to one configured Document key; `multiple`
permits a scoped collection. Neither mode bakes a particular tenant model into
adapter tables/collections: the Host resolves an opaque scope and adapters map
it through documented configuration.

## Runtime and event architecture

The package owns a framework-neutral production Runtime in addition to its React
renderer. The Runtime resolves a Host path and Scope to a Published page, loads
the current publication, validates it, prepares Resources and metadata,
establishes cache/publication identity, and supplies event context.
`PagebldrRenderer` remains the presentation module used by the Runtime.

The Host always owns actual routes and traffic. Optional `pagebldr/runtime/next`
helpers reduce App Router wiring for route resolution, metadata,
not-found/redirect outcomes, and revalidation, but the Host creates
`app/[[...slug]]/page.tsx`, decides how it coexists with application routes, and
operates the deployment. Vite/React Router examples prove the Runtime is not
Next.js-specific.

Events use two schema-versioned channels:

- Audit events: durable editor/server actions such as create, save, command,
  conflict, Revision, restore, publish, unpublish, migrate, delete, and
  permission refusal. They carry Host-supplied Actor/Scope/correlation identity
  and are transactionally associated with mutations where the Storage Provider
  supports it.
- Analytics events: consent-aware published-page Visits and semantic Element
  Interactions. They are batched, deduplicable, bounded-retry, and contain safe
  structural identifiers rather than authored content or arbitrary DOM data.

Hosts configure Event sinks and therefore control collection, storage, querying,
retention, redaction, consent, export, dashboards, and cost. Initial sinks are
memory/callback, development console, storage-backed Audit events, and an
OpenTelemetry-compatible integration. Provider integrations such as PostHog or
Sentry can be Host sinks or later optional adapters; `pagebldr` never sends
telemetry to its own service.

Authorized developers can query Audit events through the framework-neutral
server interface and expose them in their own application. Analytics
availability comes from the configured sink. The package provides event types,
query contracts where storage-backed, documentation, and examples—not a hosted
analytics dashboard.

## Phase 0 — Resolve foundations

### Work

- Confirm GitHub owner/visibility, npm identity, licence, React/Node/browser
  floor, and schema contract.
- Decide the public documentation domain and Vercel team/project ownership.
- Audit copyright and dependency licences for every extracted source file,
  fixture, shadcn primitive, ReUI composition, font, icon, and asset.
- Record the pinned Quizr source commit and exact extraction inventory without
  changing its worktree.
- Convert accepted hard-to-reverse decisions into concise ADRs.

### Decisions recommended

- Public GitHub repository under Startup Media ownership.
- Unscoped `pagebldr` if still available; scoped fallback otherwise.
- MIT, subject to source-ownership review.
- React peers `^18.3 || ^19`; Node 20 development floor and a release runner
  meeting npm trusted-publishing requirements.
- Fumadocs MDX, Next.js 16, Tailwind 4, and default Orama search for
  `apps/docs`.
- Standard Schema-compatible public schema seam if the prototype preserves
  strong inference; Zod may remain an implementation dependency.

### Exit gate

Every owner decision is recorded, the source inventory is reproducible, and no
unresolved licensing issue affects intended package contents.

Phase 0 evidence is maintained in
[the source and licence inventory](source-and-license-inventory.md),
[foundation decisions](../../owner-decisions.md), applicable ADRs under
`docs/adr/`, and the Phase 0 audit.

## Phase 1 — Repository and quality scaffold

### Work

- Establish pnpm workspace, Turborepo tasks, shared TypeScript/ESLint/Prettier
  configuration, `.gitignore`, editor settings, and package-manager pinning.
- Create private workspace manifests for `apps/docs`, examples, and internal
  modules.
- Configure Changesets, contribution guide, code of conduct, security policy,
  support policy, licence, and pull-request template.
- Add CI for install lockfile integrity, formatting, lint, typecheck, tests,
  builds, dependency licences, package exports, and `git diff --check`.
- Add a tarball job that packs the library and installs it into isolated Vite
  and Next.js consumer fixtures.
- Add public-interface snapshots and size budgets before implementation expands
  the export surface.

### Exit gate

A clean checkout installs reproducibly and all empty-scaffold CI tasks pass on
supported platforms. The tarball contains only intended files and examples
cannot be published.

## Phase 2 — Public-interface tracer

### Work

- Implement minimal compile-only forms of `createPagebldr`, `defineElement`,
  `PagebldrEditor`, and `PagebldrRenderer`.
- Implement compile-only forms of `createPagebldrServer`, the Storage adapter
  contract, Provider capabilities, and single/multiple Collection policies.
- Prototype both direct Zod and Standard Schema-compatible Element definitions
  with inferred props, defaults, migrations, controls, and references.
- Exercise controlled editor events, save/publish intents, Resource adapters,
  errors, and prepared resource resolution through type fixtures.
- Prove the single published package and subpath export design under ESM, SSR,
  Vite, and Next.js.
- Reject duplicate registrations and invalid configuration during
  `createPagebldr()` construction.

### Exit gate

The Vite and Next.js tracer consumers compile from a packed tarball; React is
externalized; server imports do not access browser globals; and the chosen
interface is smaller than exposing registry orchestration directly.

## Phase 3 — Document kernel

### Work

- Port and neutralize IDs, errors, constants, Document schemas/types, creation,
  cloning, serialization, structural index, and validation.
- Preserve normalized Elements, root ownership, one-parent invariant, ordered
  classes/variables, responsive states, and structural limits.
- Implement package-native `format` and `schemaVersion` identifiers from
  version 1.
- Implement deterministic Document migrations and Element migration chains with
  explicit future/missing/invalid errors.
- Create immutable shallow, deep, invalid, and 500-Element package fixtures.

### Tests

- Round-trip and canonical serialization.
- Cycles, multiple parents, orphans, broken references, duplicate order entries,
  invalid IDs, future schemas, and missing migrations.
- Determinism, input immutability, and migration idempotence at the current
  version.

### Exit gate

The framework-independent kernel has no React/DOM/product imports, and every
structural invariant is exercised through `builder.documents`.

## Phase 4 — Editing engine

### Work

- Port command-only mutations for insert, remove, move, duplicate, properties,
  styles, classes, variables, settings, lock, and visibility.
- Port patches, inverse patches, bounded Local history, transactions/coalescing,
  and clipboard subtree remapping.
- Define semantic `DocumentChangeEvent` metadata and changed Element IDs.
- Add command availability selectors so UI and keyboard shortcuts share policy.
- Keep save, autosave, publication, durable Revisions, and optimistic
  concurrency outside the engine.

### Tests

- Every command's success and refusal modes.
- Undo/redo round trips, history branching, coalescing, clipboard collision
  avoidance, locked content, and deep-tree performance.
- Property-based command sequences that maintain Document validity.

### Exit gate

No editor mutation bypasses command dispatch, and arbitrary valid command
sequences preserve structural invariants.

## Phase 4A — Server lifecycle and Storage adapters

### Work

- Implement framework-neutral `createPagebldrServer()` with load, list, create,
  save, delete, Revision, restore, publish, and unpublish operations.
- Define the Storage adapter contract, mandatory Provider identity, capability
  negotiation, transaction/concurrency requirements, schema setup guidance, and
  conformance suite.
- Implement the memory adapter, then Prisma MongoDB and Prisma PostgreSQL as
  independent conformance targets.
- Implement selected Drizzle dialect targets only after their guarantees pass
  the same suite.
- Implement single and multiple Collection policies without encoding Host
  tenancy.
- Add an optional Next.js handler factory while keeping authentication,
  authorization, scope resolution, rate limiting, runtime, and deployment
  Host-supplied.

### Tests

- Adapter conformance for atomic save, optimistic conflict, Revision
  ordering/restoration, publication pointers, deletion, pagination, scope
  isolation, migrations, and failure rollback.
- Provider-specific integration tests against real ephemeral databases where
  practical; mocks do not establish Provider support.
- Identical lifecycle behavior through direct server calls and Host-mounted
  handlers.

### Exit gate

Memory and at least two materially different Provider implementations pass the
conformance suite, unsupported capabilities fail explicitly, and no test
requires a package-operated API.

## Phase 5 — Styling engine

### Work

- Port responsive breakpoints, interaction states, design variables, reusable
  classes, and Style capability definitions.
- Implement deterministic, namespace-scoped CSS compilation with safe escaping
  and stable ordering.
- Separate authored page CSS from editor-shell CSS.
- Specify documented theme custom properties for the editor and renderer.
- Add CSP/SSR guidance for generated styles and an optional extraction interface
  if runtime `<style>` output later proves insufficient.

### Tests

- Responsive cascade, pseudo-state output, variable resolution, class
  precedence, invalid values, escaping, deterministic snapshots, and hidden
  Elements.
- CSS output budgets for shallow and 500-Element Documents.

### Exit gate

The same Document produces byte-stable CSS across runs, and consumer styling
requires only `pagebldr/styles.css` plus documented custom properties.

## Phase 6 — Definitions, standard library, and renderer

### Work

- Implement coherent Element definitions containing schema, defaults, child
  policy, Style capabilities, migrations, Controls, rendering, accessibility
  metadata, and Resource reference extraction.
- Implement generic Resource references and `resolveDocumentResources()` for
  preparation before synchronous SSR rendering.
- Port standard atomic Elements incrementally: container, heading, text,
  button/link, image, video, icon, divider, spacer, list, accordion, tabs,
  testimonial, rating, counter, countdown, social links, logo cloud, and
  gallery.
- Move all rendering out of the source central type switch and into definitions.
- Define explicit unknown-Element behavior for edit, preview, and published
  rendering.
- Implement Blocks and Templates strictly as factories for editable Element
  trees.

### Tests

- SSR and hydration for every standard Element under React 18 and 19.
- Accessibility semantics, invalid props, child policies, Resource
  extraction/resolution, unknown Elements, and editor/public rendering parity.
- No Next.js runtime imports in the published renderer.

### Exit gate

Every standard Element renders through its definition, renderer output is
SSR-safe, and two independent Resource adapter implementations prove the seam is
real.

## Phase 6A — Production Runtime and events

### Work

- Implement `createPagebldrRuntime()` with path normalization, Published page
  lookup, validation, Resource preparation, metadata, canonical URL, cache
  identity, and found/not-found/redirect/error outcomes.
- Implement `PagebldrPage` as the React bridge from a prepared Published page to
  the renderer and client interaction instrumentation.
- Add optional Next.js route/metadata/cache helpers and a router-neutral example
  interface.
- Define versioned Audit and Analytics envelopes, stable event taxonomy, Event
  sink contract, redaction defaults, deduplication IDs, correlation, batching,
  bounded retry, and failure policy.
- Emit server Audit events for lifecycle operations and editor Audit events for
  semantic actions without storing raw authored content.
- Emit configurable Visit events and renderer-owned semantic Interaction events;
  custom Elements declare their own trackable actions.
- Implement memory/callback, development console, storage-backed Audit, and
  OpenTelemetry-compatible sinks.
- Add authorized, paginated Audit queries to the server module while leaving
  Host authorization and UI outside the package.

### Tests

- Route normalization, scoped lookup, publication selection,
  redirect/not-found/error outcomes, metadata, Resource failures, SSR/hydration,
  and cache identity.
- Event schemas, version evolution, redaction, consent gating, Actor/Scope
  propagation, ordering, deduplication, batching, retry exhaustion, and sink
  failure isolation.
- Transactional Audit append with each Provider capability; explicit failure
  when configured guarantees cannot be met.
- Visit counting-point modes and semantic click/submit tracking without global
  arbitrary-DOM capture.

### Exit gate

Next.js and Vite Hosts display the same Published page through the Runtime;
Audit events are queryable through an authorized Host integration; Analytics
events reach a configured sink only under the Host consent policy; and no
traffic or telemetry reaches package-owned infrastructure.

## Phase 7 — React editor foundation

### Work

- Implement controlled editor context, internal store, selectors, command
  dispatch, selection, viewport, keyboard map, and interaction state.
- Add package-owned shadcn primitives through the CLI and inspect their source,
  dependencies, imports, licences, and accessibility.
- Use ReUI registry compositions for suitable higher-level editor surfaces;
  retain provenance and adapt them behind package-owned modules.
- Build the editor shell, top bar, canvas, selection overlay, drop zones,
  library, Structure panel, inspector, Control rendering, variable/class
  managers, dialogs, status, and error surfaces.
- Compile Tailwind/shadcn/ReUI source into distributed CSS; ensure consumers
  never scan package source with Tailwind.
- Implement edit, preview, and read-only modes plus save/publish pending,
  success, and failure feedback.

### Interaction requirements

- Complete keyboard access to selection, tree movement, insertion, deletion,
  undo/redo, panel navigation, dialogs, and any drag/drop action.
- Visible focus, correct accessible names, announced errors/status, zoom/reflow,
  forced-colors, reduced motion, and no focus traps.
- Pointer interactions cannot be the only way to operate the editor.

### Exit gate

The controlled editor completes a full authoring flow in a real browser, passes
automated accessibility checks in every revealed state, and passes a documented
manual keyboard review.

## Phase 8 — Typed editor composition

### Work

- Implement typed Slots, Contributions, Presets, placement validation,
  capability filtering, and public editor context.
- Ship the polished `standard` preset.
- Prove the interface with a materially different `compact` or `focus` preset
  using only public composition functions.
- Add custom panel, panel tab, toolbar action, status item, and canvas overlay
  examples.
- Keep internal store, DOM structure, and UI module imports inaccessible to
  Contributions.

### Exit gate

Two layouts arrange the same built-in functionality without internal imports,
and invalid slot/contribution combinations fail during configuration.

## Phase 9 — Product-neutral examples

### Vite basic

- In-memory/localStorage persistence, asset/link adapters, edit/preview routes,
  and production renderer.

### Next.js basic

- Host-owned catch-all page using the Runtime, server-rendered Published page,
  metadata, client-only editor entry, prepared Resources, Visit/Interaction
  events, and no default `transpilePackages` workaround.

### Custom Elements

- A third-party Element, Control, Block, Template, Style capability, reference
  extractor, migration, and renderer.

### Custom persistence

- Callback-only persistence plus optional server-backed persistence, Provider
  selection, optimistic conflict, publication, permission capabilities, and Host
  notifications.

### Exit gate

All examples install only the packed public package, contain no internal
aliases, and pass end-to-end browser flows.

## Phase 10 — Fumadocs documentation application

### Foundation

- Create `apps/docs` using Next.js 16 App Router, Fumadocs Core/UI/MDX, Tailwind
  4, typed frontmatter, and local `content/docs`.
- Use Fumadocs layouts for the documentation site; shadcn/ReUI remain the editor
  package's UI foundation rather than a reason to replace Fumadocs documentation
  primitives.
- Configure static parameters and metadata, default Orama search, sitemap,
  robots, canonical URLs, Open Graph metadata, edit-on-GitHub links, and
  analytics with a privacy decision.
- Generate `/llms.txt`, `/llms-full.txt`, and per-page `.md` responses from the
  same MDX source.
- Keep optional AI chat out of the initial release unless its provider, cost,
  privacy, and abuse controls are explicitly approved.

### Initial information architecture

```text
Introduction
  What pagebldr is
  Installation
  Five-minute quickstart
Core concepts
  Documents and schemas
  Elements, Blocks, and Templates
  Commands and Local history
  Styles and design variables
React integration
  Controlled editor
  Production renderer
  Modes and capabilities
Host integrations
  Saving and publishing
  Assets and links
  Resource adapters
  Permissions and revisions
  Audit events and developer access
  Analytics sinks, consent, and privacy
Production Runtime
  Route resolution
  Next.js App Router
  Vite and React Router
  Visits and interactions
Extending pagebldr
  Custom Elements and Controls
  Custom Blocks and Templates
  Editor Contributions and Presets
Operations
  Migrations
  SSR and CSP
  Accessibility
  Performance
  Troubleshooting
Reference
  Configuration
  Public exports
  Error codes
  Changelog
```

### Executable documentation

- Typecheck every code sample where practical and import examples from the
  packed package.
- Embed focused component stories or sandboxes only through stable public
  exports.
- Add link checking, frontmatter validation, spelling/terminology checks, and
  stale-export detection.
- Make the quickstart runnable without a database or external account.

### Deployment

- Create a separate Vercel project rooted at `apps/docs` after explicit
  authorization.
- Configure preview deployments for pull requests and production deployment from
  the protected default branch.
- Set the final docs domain, redirect policy, environment validation, build
  command, and monorepo install behavior.
- Add smoke checks for the home page, quickstart, search endpoint, `llms.txt`,
  raw Markdown, sitemap, and canonical metadata after deployment.

### Exit gate

A new developer can install the packed alpha and complete edit/save/render from
the deployed quickstart; search and machine-readable docs work; all samples
compile; and the production deployment passes smoke and accessibility checks.

## Phase 11 — Hardening and release engineering

### Work

- Add browser matrices, React 18/19 jobs, SSR/hydration checks, performance
  regression budgets, visual regression coverage, and supply-chain scanning.
- Verify package side effects, CSS export, declaration maps, source maps,
  tree-shaking, minification, and tarball contents.
- Run API-surface comparison and require Changesets for public changes.
- Bootstrap the first npm prerelease manually with 2FA, then configure GitHub
  Actions trusted publishing/OIDC and provenance.
- Publish `0.x` alphas under the `alpha` dist-tag; never publish prereleases as
  `latest`.
- Publish docs matching each prerelease and label version stability clearly.

### Alpha exit gate

- Package installation works in isolated Vite and Next.js consumers.
- Kernel, commands, styles, renderer, standard Elements, controlled editor,
  standard preset, generic Resources, migrations, and Vite example are complete.
- No product-specific identifiers or integrations exist in published files.
- Public docs cover every alpha export and known limitation.

### Beta exit gate

- Alternate composition preset and all four examples pass.
- Accessibility, browser, performance, SSR, migration, public-interface, and
  packed-consumer suites pass.
- At least two independent real Hosts can integrate without a package change or
  privileged adapter.
- Security, contribution, support, and release documentation are complete.

## Phase 12 — Host adoption

Host adoption begins only after a stable alpha is consumable from npm or an
approved prerelease channel.

- Quizr installs `pagebldr`, maps its storage/publication/resources through
  ordinary Host code, and migrates its application data in the Quizr repository.
- Tener follows the same process independently when its product work is ready.
- Adoption findings may motivate general interface improvements only when they
  benefit arbitrary Hosts; product-specific behavior remains in the Host.
- Compatibility and rollback plans belong to each Host repository, not this
  package.

### Exit gate

Each Host can upgrade or remove `pagebldr` as an ordinary dependency, and no
Host-specific module is published from this repository.

## Cross-cutting test matrix

| Area        | Required verification                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| Documents   | schema, invariants, serialization, migrations, future-version errors                       |
| Commands    | success/refusal, undo/redo, property-based sequences, clipboard                            |
| Styles      | deterministic CSS, cascade, escaping, CSP guidance, size budgets                           |
| Renderer    | SSR, hydration, React 18/19, accessibility, Resources, unknown Elements                    |
| Editor      | controlled updates, keyboard, drag alternatives, focus, read-only/preview                  |
| Server      | lifecycle, Provider capabilities, adapter conformance, concurrency, Revisions, publication |
| Runtime     | routes, Published pages, metadata, caching, Resources, SSR, framework helpers              |
| Events      | schemas, Audit durability/querying, Analytics consent/batching, redaction, sinks           |
| Extensions  | Elements, Controls, Blocks, Templates, Resources, Contributions, Presets                   |
| Packaging   | exports, types, ESM, side effects, tarball contents, isolated consumers                    |
| Docs        | build, links, samples, search, metadata, llms files, deployed smoke tests                  |
| Performance | deep tree, 500 Elements, command latency, CSS compile, editor interaction                  |

## Review checkpoints

Product-owner review is required after phases 0, 2, 6, 8, 10, and before each
npm release. These checkpoints cover respectively: irreversible foundations,
public interface, renderer/standard library, editor composition,
documentation/deployment, and release authority.

## Separate Startup Media work

The Startup Media repository repair does not share implementation phases,
commits, or deployment with `pagebldr`. It starts from its existing audit only
after its application lifecycle, tracked secret response, generated artifact
policy, and uncommitted `platform/marketing` ownership are resolved.
