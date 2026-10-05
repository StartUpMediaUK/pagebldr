# Public interface proposal

Status: implemented and evolving through the standalone-package phase gates.

## Design conclusion

Use one application-level `createPagebldr()` factory rather than making a config
filename part of the runtime contract. A conventional `pagebldr.config.ts` is
valuable for discovery, tooling, examples, and a future CLI, but JavaScript
bundlers do not share a portable mechanism for loading it automatically. The
exported configuration value is the real interface; its filename is convention.

The factory creates a configured namespace with a small set of capabilities:

```ts
// pagebldr.config.ts
import { createPagebldr, standardElements } from "pagebldr";

export const builder = createPagebldr({
  namespace: "my-app",
  elements: standardElements,
  resources: {
    asset: assetAdapter,
    link: linkAdapter,
  },
  editor: {
    preset: "standard",
    contributions: [],
  },
});
```

`defineConfig()` alone is too shallow: it validates/types an object but does not
hide registry construction, duplicate detection, migration graph checks,
standard contributions, or renderer assembly. `createPagebldr()` can do that
work once and return an immutable configured module. A `defineConfig()` identity
helper may be added later only if configuration authoring without instantiation
proves useful.

## Configuration interface

```ts
interface PagebldrOptions {
  namespace: string;
  elements?: readonly ElementDefinition[];
  blocks?: readonly BlockDefinition[];
  templates?: readonly TemplateDefinition[];
  controls?: readonly ControlDefinition[];
  styleCapabilities?: readonly StyleCapabilityDefinition[];
  resources?: Readonly<Record<string, ResourceAdapter>>;
  editor?: EditorComposition;
}
```

The namespace qualifies package-generated IDs, clipboard formats, CSS selectors,
and persisted package metadata. It is not a tenant or database namespace.
Creation rejects duplicate keys and invalid migration chains immediately.

The returned value should expose deliberate subpath-friendly capabilities rather
than registries and classes:

```ts
interface Pagebldr {
  readonly namespace: string;
  documents: {
    create(input: CreateDocumentInput): PageDocument;
    parse(input: unknown): PageDocument;
    migrate(input: unknown): PageDocument;
    validate(input: unknown): ValidationResult;
  };
  editor: PagebldrEditorDefinition;
  renderer: PagebldrRendererDefinition;
  runtime: PagebldrRuntimeDefinition;
}
```

Internal registry classes are implementation details. Extension authors submit
definitions through `createPagebldr`; they should not orchestrate registry
ordering themselves.

## Styling interface

Hosts register named Style capabilities rather than passing arbitrary editor
configuration. Capabilities may deliberately overlap when the same property is
authored in different inspector contexts; the standard set shares `display`
between Layout and Responsive visibility.

```ts
const builder = createPagebldr({
  namespace: "my-app",
  styleCapabilities: [
    defineStyleCapability({
      key: "spacing",
      label: "Spacing",
      properties: ["gap", "padding", "margin"],
    }),
  ],
});

const compiled = builder.styles.compile(document);
const resolved = builder.styles.resolve(document, elementId, "tablet", "hover");
const applicableKinds = builder.styles.variableKindsForProperty("padding");
```

`compiled.css` is authored page CSS only. It is byte-stable for the same
Document, scoped by the builder namespace and Document ID, and safe to extract
at build time or emit in an SSR `<style>` element. When a Host uses a CSP, it
must hash the returned CSS or apply its request nonce to that `<style>` element;
pagebldr does not weaken the Host policy.

The standard engine exposes the nine Layout, Spacing, Size, Position,
Typography, Background, Border, Effects, and Responsive visibility groups. It
accepts the 91-property Quizr-derived allowlist, resolves Desktop → Tablet →
Mobile inheritance and Normal-state fallback, and reports each winning value's
Class/local, breakpoint, state, and inherited origin. CSS includes editor-only
forced-state selectors and rejects rule delimiters, comments, script/expression
syntax, imports, and unsafe URL values. `variableKindsForProperty()` exposes the
same typed-Variable applicability policy enforced during Document validation, so
editor integrations do not need to duplicate it.

The renderer applies the returned `data-pagebldr` and `data-pagebldr-document`
scope attributes. Element and Class selectors use package-owned data attributes
rather than public implementation classes.

Editor-shell and renderer baseline CSS is separate:

```ts
import "pagebldr/styles.css";
```

Hosts may theme it with `--pagebldr-background`, `--pagebldr-foreground`,
`--pagebldr-focus`, and `--pagebldr-font-sans`. Consumers do not need Tailwind
or access to package source classes.

Secondary editor text and inactive tabs use `--pagebldr-muted-foreground`
(default `#62626b`) without compositing foreground opacity. Host themes should
maintain readable contrast against both background and muted surfaces. This
editor token does not rewrite authored Document colors.

## Elements, Resources, Blocks, and Templates

An Element definition owns its property schema and defaults, child policy, Style
capabilities, migration, Controls, accessibility metadata, Resource references,
and framework-neutral render tree. React rendering translates that tree; it does
not switch on Element type. The bundled `standardElements` and
`standardStyleCapabilities` can be installed like any other definitions.

```ts
const builder = createPagebldr({
  namespace: "my-app",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  resources: {
    asset: {
      reference: assetReferenceSchema,
      resolve: ({ id }) => assetUrl(id),
    },
  },
});

const resources = await resolveDocumentResources(builder, document, {
  scope: { workspace: "example" },
});
```

The Host resolves Resources before synchronous SSR and passes the resulting map
to `PagebldrRenderer`. Missing adapters and invalid references fail explicitly.
The renderer never browses, uploads, or fetches Resources while rendering.

The standard library is the complete 24-Element baseline: Container, Heading,
Rich Text, Button, Logo, Menu, Copyright, Image, Video, Icon, Divider, Spacer,
List, Icon List, Accordion, Tabs, Testimonial, Star Rating, Counter, Progress,
Countdown, Social Links, Logo Cloud, and Gallery / Carousel. Their schemas are
strict. Image, Video, Progress, and Gallery / Carousel are currently version 2
and include deterministic v1 migrations. Definitions expose nested Resource
references and Destinations rather than hiding them in renderer code.

Standard media uses either a safe HTTP(S) source or a neutral
`ResourceReference`. Resource adapters remain the only route from a Host asset
identity to a renderable URL. The standard font catalogue exports ten approved
families through `standardFontFamilies` and `findStandardFontFamily()`; Hosts
provide any corresponding font custom properties.

Interactive standard Elements emit definition-owned semantic markup and widget
descriptors. `PagebldrRuntimeInteractions` supplies the client behavior used by
Menu, Tabs, Countdown, and Gallery / Carousel. `PagebldrPage` and the standard
editor mount it automatically; a Host using `PagebldrRenderer` directly mounts
it alongside the renderer when client interaction is required. The renderer
itself stays SSR-safe.

Blocks and Templates are factories for ordinary editable Element trees:

```ts
const hero = defineBlock({
  key: "hero",
  label: "Hero",
  create: () => ({
    type: "container",
    children: [{ type: "heading", props: { text: "Welcome", level: 1 } }],
  }),
});
```

They have no special persisted identity or privileged renderer behavior.

## Document schema and editor commands

Schema v2 stores normalized Elements, Classes, typed Variables and complete page
settings: content width, authored breakpoints, default-header intent, and
search/social SEO. A social image is a neutral `ResourceReference`, not a
product asset ID. The built-in deterministic v1 → v2 migration converts the
former metadata shape and supplies safe defaults.

Element definitions may expose typed Destinations for semantic validation.
`parseDestination()` accepts external, anchor, email, telephone and Host
application Resource destinations. Anchor IDs are unique lowercase slugs and
anchor targets must reference existing Elements.

All mutations use `builder.editor.dispatch()`. Alongside structural, content,
Class, Variable and settings commands, the public command union includes atomic
create-and-assign Class, assigned-Class reordering, Class style replacement,
subtree paste with fresh IDs, style clipboard paste and whole-Template
application. Template application preserves Document ID, title, slug, root
identity and SEO while replacing the design as one reversible Action.

`builder.editor.history` defaults to 100 Actions, coalesces the same non-null
key through the inclusive 750ms boundary, and exposes undo, redo and clamped
position jumps. Local history remains unrelated to durable Revisions.

## Production Runtime and events

The Runtime resolves a normalized Host path and optional Host scope into a
validated, migrated, Resource-prepared Published page. Found pages include
metadata, canonical identity, cache identity, and the exact event context used
by `PagebldrPage`. Redirect, not-found, and isolated error outcomes are
explicit.

```ts
const events = createEventDelivery({
  sink: callbackEventSink((batch) => analytics.write(batch)),
  consent: (event) => consent.allows(event.type),
});

const runtime = createPagebldrRuntime({
  builder,
  canonicalOrigin: "https://example.com",
  publications: {
    resolve: ({ path, scope }) => loadPublishedDocument(path, scope),
  },
  events,
});
```

`PagebldrPage` renders the prepared page and can record a Visit at client mount.
Semantic interactions are collected only from definition-owned
`data-pagebldr-action` markers; pagebldr does not install arbitrary global DOM
capture. Set `visit="manual"` when the Host wants to call
`runtime.recordVisit(page)` at a different counting point.

Audit and Analytics are separate schema-versioned envelopes. Audit events carry
Host Actor, Scope, and correlation context; Analytics excludes Actor identity
and passes through the Host consent policy. Event data is allowlisted to scalar
metadata and sensitive key names are removed. Raw authored content is not
emitted.

Memory, callback, console, Audit-store, and OpenTelemetry-style sinks are local
adapters. The Host owns storage, querying, retention, export, privacy, consent,
and costs. `createAuditQuery()` demonstrates an authorized, scope-resolved Host
HTTP integration. No event has a package-owned network destination.

Next.js helpers under `pagebldr/runtime/next` translate prepared pages to
metadata, cache tags, and route outcomes without owning an application route.

## React interface

The primary editor is controlled:

```tsx
import { PagebldrEditor } from "pagebldr/react";
import "pagebldr/styles.css";

<PagebldrEditor
  builder={builder}
  document={document}
  onChange={(event) => setDocument(event.document)}
  onSave={async ({ document, reason, signal }) => save(document)}
  onPublish={async ({ document, signal }) => publish(document)}
  mode="edit"
/>;
```

Editor properties:

```ts
interface PagebldrEditorProps {
  builder: Pagebldr;
  document: PageDocument;
  onChange(event: DocumentChangeEvent): void;
  onSave?: (
    request: SaveRequest,
  ) => void | SaveResult | Promise<void | SaveResult>;
  onPublish?: (
    request: PublishRequest,
  ) => void | PublishResult | Promise<void | PublishResult>;
  mode?: "edit" | "preview" | "readOnly";
  applicationDestinations?: readonly ApplicationDestinationOption[];
  resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
  preset?: EditorPreset;
  contributions?: readonly EditorContribution[];
  className?: string;
  children?: ReactNode;
}
```

`applicationDestinations` supplies the neutral Host-owned pages or records that
can be selected by a definition-owned `destination` Content control. Each option
has a user-facing `label`, a `ResourceReference`, and an optional description.
External URL, anchor, email and telephone destinations are package-owned; anchor
choices include only Elements with authored anchor IDs. The Host supplies
`resolveApplicationDestination` when application links should resolve inside
editor Preview as well as in the published renderer.

The editor derives `edit`, `save`, `publish`, and `resources` capabilities from
its controlled mode, callbacks, and configured Resource adapters. See
[editor composition](editor-composition.md) for the typed extension interface.

The default editor includes its own isolated authored canvas and compiled
presentation. One Desktop control toggles fixed and full-width modes; Tablet and
Mobile select their authored viewport independently from the Host viewport. A
canvas indicator reports the visible dimensions and active responsive range.
Zoom ranges from 25% to 200%. Fit is a persistent width-fit mode: the percentage
activates it and manual zoom disables it. Scroll-to-selection remains a separate
control. Edit-mode links are navigation-suppressed; Preview renders the current
controlled Document without editor chrome and returns with Escape. Canvas
selection, hover, inline editing and placement dispatch ordinary editor commands
and never mutate the Document directly.

The standard inspector authors registered styles through the same controlled
command path. Style contains presentation capabilities such as Typography and
Background; Advanced contains Layout, Spacing, Size, Position, Border, Effects,
and Responsive visibility. Desktop, Tablet, and Mobile authoring follows the
canvas viewport. Normal, Hover, and Focus Visible are keyboard-operable states;
the latter two are forced only on the selected edit-mode canvas Element. Fields
show their winning local/Class, breakpoint, state, and inherited origin, filter
Variables by property applicability, and provide per-property and reset-all
actions.

Scalar Content and Style inputs retain rejected drafts locally, mark the input
invalid, and associate the command/schema error with it for assistive
technology. Correcting the value commits through the existing per-field
coalescing key; Escape discards a rejected draft without changing the Document.
Undo and controlled Host updates replace stale drafts. Empty numeric drafts are
not coerced to zero, and definition-declared numeric bounds are enforced before
dispatch. Locked Elements disable Content controls as well as Style controls.
Document validation rejects unsafe CSS in local styles, Classes and Variables,
using the same safety policy as CSS compilation.

The toolbar's Page design dialog stages page settings until Apply dispatches one
`update-settings` command. Design validates content width (320–2400px), tablet
maximum (768–1200px), mobile maximum (320–767px), and requires the mobile
boundary to remain below the tablet boundary. Settings records whether the Host
should show its default header; it does not cause pagebldr to render Host
chrome. SEO & social authors the required page title as its own undoable
`update-page` command, bounded search and social copy, and `noIndex`. An
existing social-image Resource can be inspected or cleared here; choosing a new
Resource remains part of the shared media picker rather than a second,
page-specific Resource browser.

The Variables tab uses the public Variable commands for all six kinds: Colour,
Typography, Spacing, Radius, Shadow, and Content width. Authors can add, rename,
edit, reorder within a kind, and delete Variables. Each row counts Element and
Class style sources using it. Deleting an unused Variable is immediate; deleting
one in use requires an explicit destructive confirmation and clears those
declarations through the guarded `delete-variable` command so they inherit
again. Variable changes apply immediately, remain undoable, and Style fields
offer only Variables whose kind applies to that property.

There is no simultaneous `document` and `initialDocument` on this module: that
creates two state-ownership modes and synchronization ambiguity. A separate
convenience module can be introduced only if real examples prove demand:

```tsx
<UncontrolledPagebldrEditor initialDocument={document} onDocumentChange={...} />
```

`onChange` receives a semantic event containing the new Document, command
metadata, and changed Element IDs. It is synchronous and does not imply
persistence. `onSave` and `onPublish` are explicit Host intents; their return
values may supply Host metadata for display but cannot replace the controlled
Document implicitly.

These callbacks remain the client-side persistence seam. Hosts may implement
them directly or connect them to the optional `pagebldr/server` module. This
preserves local-first and unusual integrations while giving ordinary
applications a standardized save path.

Server Components import the presentation-only renderer from
`pagebldr/react/server`. This subpath contains no editor context or browser
hooks, so a Next.js Host can SSR a Runtime result without marking its route as a
Client Component. Interactive editor and analytics helpers remain explicit
client boundaries.

## Optional server interface

```ts
import { createPagebldrServer } from "pagebldr/server";
import { prismaAdapter } from "pagebldr/adapters/prisma";

export const pages = createPagebldrServer({
  builder,
  storage: prismaAdapter({
    client: prisma,
    provider: "mongodb",
  }),
  collection: { mode: "multiple" },
  revisions: { enabled: true, retention: 50 },
});
```

The server module standardizes validation/migration before persistence, atomic
saves where supported, optimistic concurrency, Revision creation/restoration,
draft and published state, and stable errors. A single-page collection is the
same storage model constrained to one configured key; it is not a different
adapter.

Every Storage adapter requires a concrete Provider/dialect. Adapter identity
alone is insufficient: `prisma + mongodb` and `prisma + postgresql` have
different capabilities. Construction validates the selected Provider, returns an
explicit capability set, and refuses unsupported features rather than silently
weakening guarantees.

Initial adapter targets are memory plus provider-tested Prisma and Drizzle
variants. The support matrix is granular—for example Prisma MongoDB and Prisma
PostgreSQL are separate conformance targets even if they share an adapter entry
point. Provider-branded databases that use the same tested dialect, such as a
hosted PostgreSQL service, normally select `postgresql` rather than receiving a
duplicate branded adapter.

The Host owns transport. An optional Next.js factory may be mounted inside the
Host:

```ts
// Host: app/api/pagebldr/[...all]/route.ts
import { createPagebldrHandler } from "pagebldr/server/next";
import { pages } from "@/pagebldr.server";

export const { GET, POST, PUT, DELETE } = createPagebldrHandler(pages, {
  authorize: authorizePageOperation,
  resolveScope: resolvePageScope,
});
```

The file, runtime, authentication, authorization, rate limiting, observability,
scaling, and bill all belong to the Host. The handler factory is optional;
direct calls, Server Actions, REST, GraphQL, and tRPC remain valid. The
`pagebldr` repository deploys no shared document API.

## Events and developer access

The package emits discriminated, schema-versioned events rather than
unstructured log strings:

```ts
type PagebldrEvent = AuditEvent | AnalyticsEvent;

interface EventEnvelope<TType extends string, TData> {
  id: string;
  schemaVersion: number;
  type: TType;
  occurredAt: string;
  namespace: string;
  documentId: string;
  publicationId?: string;
  scope?: Record<string, string>;
  actor?: { id: string; kind: "user" | "system" };
  correlationId?: string;
  data: TData;
}
```

Audit event families include Document creation/save/delete, command application,
Revision creation/restoration, publish/unpublish, migration, conflict, and
permission refusal. Analytics event families initially include `page.visit` and
`element.interaction`; interaction data identifies the Element, definition type,
action (`click`, `submit`, or another registered semantic action), destination
kind, and publication—not arbitrary DOM text.

An Event sink accepts one or both channels:

```ts
interface EventSink {
  audit?: { append(event: AuditEvent, context: EventContext): Promise<void> };
  analytics?: {
    append(
      events: readonly AnalyticsEvent[],
      context: EventContext,
    ): Promise<void>;
  };
}
```

Server-backed Audit events are appended in the same adapter transaction as the
mutation when the selected Provider supports that guarantee; otherwise server
construction exposes/refuses the weaker capability according to configuration.
Audit reads use a paginated server query interface gated by Host authorization.
Analytics events are batched, carry deduplication IDs, and are delivered to the
Host sink with bounded retry. The package supplies memory/callback and
development console sinks, a storage-backed Audit sink, and an
OpenTelemetry-compatible sink where the contract fits; Hosts can integrate
PostHog, Sentry, a warehouse, or their own database without changing emitted
event schemas.

No raw Document, Element content, URL query string, IP address, email, or
free-form property value is included by default. The Host supplies Actor, Scope,
consent state, session/visitor identifiers, redaction, retention, and access
policy. Public Analytics collection is disabled until configured; consent denial
prevents client analytics dispatch.

Developers access events through their chosen sink or through authorized Host
endpoints backed by `pages.audit.list(...)`. `pagebldr` does not ship a
cross-tenant dashboard or remotely collect telemetry.

## Production Runtime

`PagebldrRenderer` renders a prepared Document; it does not own routing. The
Runtime is the deeper route-level module:

```ts
const runtime = createPagebldrRuntime({
  builder,
  publications: pages.publications,
  resources: builder.resources,
  events,
});

const result = await runtime.resolve({
  path: "/pricing",
  scope,
  request: { locale, consent, visitorId },
});
```

Resolution returns `found`, `notFound`, `redirect`, or `error`. A found
Published page contains the validated current publication, prepared Resource
resolutions, metadata/SEO, canonical path, cache identity, and event context.
Rendering remains explicit:

```tsx
<PagebldrPage runtime={runtime} page={result.page} />
```

Next.js integration lives in the Host route:

```tsx
// Host: app/[[...slug]]/page.tsx
export default async function Page({ params }: PageProps) {
  const path = toPath((await params).slug);
  const result = await runtime.resolve({ path, scope: await resolveScope() });
  if (result.status === "notFound") notFound();
  if (result.status === "redirect") redirect(result.location);
  return <PagebldrPage runtime={runtime} page={result.page} />;
}
```

An optional `pagebldr/runtime/next` helper can reduce this wiring and provide
metadata/cache helpers, but the Host owns the route, conflicts with other
application routes, revalidation policy, domain mapping, runtime, and traffic.
Vite/React Router integrations use the same Runtime resolution interface.

Visits are emitted after the Host-defined counting point (server resolution,
successful response, or client mount). Clicks use renderer-owned semantic
instrumentation on registered interactive Elements, not a global capture of
every DOM click. Custom Element definitions declare their Analytics actions
explicitly.

The renderer stays small and SSR-safe:

```tsx
<PagebldrRenderer
  builder={builder}
  document={document}
  mode="published"
  resources={preparedResources}
  resolveApplicationDestination={(reference) => hostHref(reference)}
/>
```

Hidden Elements remain visible and marked while editing, and are omitted from
preview/published output. Unknown Elements follow the same edit-only discovery
rule. Anchors become stable DOM IDs, and typed Destinations resolve to HTTP(S),
fragment, mail, telephone, or Host application hrefs without a central
Element-type switch.

## Resource seam

Assets and links are Resource kinds, not hard-coded special cases. Quizr, Tener,
and other Hosts use this identical seam without package-supplied product
adapters. A Resource adapter is capability-based so read-only rendering does not
require editor methods:

```ts
interface ResourceAdapter<Reference = unknown, Item = unknown> {
  reference: Schema<Reference>;
  resolve(
    reference: Reference,
    context: ResourceContext,
  ): string | null | Promise<string | null>;
  browse?: (
    request: BrowseRequest,
    context: ResourceContext,
  ) => Promise<BrowseResult<Item>>;
  upload?: (request: UploadRequest, context: ResourceContext) => Promise<Item>;
  inspect?: (
    references: readonly Reference[],
    context: ResourceContext,
  ) => Promise<InspectionResult>;
}
```

Synchronous SSR remains possible when resolution data is already present.
Because React render functions cannot await arbitrary adapters portably, the
renderer should accept a prepared resolution map or a synchronous resolver; an
exported async `resolveDocumentResources()` prepares data before render. This
keeps data fetching outside React rendering.

## Element definition seam

An Element definition coherently owns the facts currently split between Quizr's
registry and central runtime switch:

```ts
interface ElementDefinition<Props, Type extends string = string> {
  type: Type;
  version: number;
  label: string;
  category: string;
  props: Schema<Props>;
  defaults(): Props;
  children: ChildPolicy;
  styles: readonly StyleCapabilityKey[];
  migrate?: ElementMigration<Props>;
  controls?: readonly ElementControl<Props>[];
  styleControls?: readonly ElementControl<Props>[];
  inlineEditing?: {
    property: string;
    read(props: Props): string;
    update(value: string, props: Props): Partial<Props>;
  };
  render(props: ElementRenderProps<Props>): React.ReactNode;
  references?: (props: Props) => readonly ResourceReference[];
  accessibility?: AccessibilityContract<Props>;
}
```

Element schemas use the Standard Schema v1 contract. The Phase 2 tracer proved
that a Zod schema can be passed directly while retaining inference for defaults,
migrations, controls, and reference extraction. This keeps Zod ergonomic for
Hosts that already use it without making Zod a public runtime dependency or
preventing other Standard Schema-compatible validators.

Content controls are serializable definition metadata rather than React
components. The scalar contract is discriminated by `kind`: `text` supports an
optional placeholder, `number` supports minimum, maximum and step, `boolean`
renders as a switch, and `select` owns its labelled string or numeric options.
`destination` authors external, anchor, email, telephone and neutral Host
application destinations, and may opt into a no-destination state. Resource and
ordered-item descriptors extend this same definition-owned contract; they are
not inferred by the inspector from runtime values. `rich-text` owns its allowed
structured block types and new-block default. A `collection` descriptor owns its
item label, limits, fresh-ID policy, serializable default item and nested text,
textarea, select and Destination controls. The standard editor supplies add,
remove and keyboard-operable reorder actions, while preserving the Element
schema's minimum and maximum. Controls may declare one or more serializable
`visibleWhen` conditions for dependent fields such as Menu collapse settings.
The optional `labelWhen` array provides ordered contextual labels; the first
entry whose `conditions` all match wins, otherwise the base label is used.
Conditions use the same typed keys and equality rules as `visibleWhen`.

Element-specific visual options use the same contract through `styleControls`.
They render before the registered responsive Style capabilities and update
ordinary Element props through controlled commands. A `select` may request the
`segmented` presentation for short visual choices while retaining a labelled
keyboard-operable group. The standard Logo, Menu and Gallery definitions use
this seam; custom definitions receive no privileged component path. Semantic
`viewport`, `horizontal-alignment` and `vertical-alignment` presentations supply
package-owned icon choices for the standard values
(`desktop`/`tablet`/`mobile`/`never` or `start`/`center`/`end`). Other options
retain their text labels; core metadata contains no React icons. A bounded
`number` may request `presentation: "slider"` with optional display `unit`.
Sliders use the same prop commands and coalescing policy as numeric inputs and
support arrow keys, Page Up/Down and Home/End. Without both bounds, the editor
keeps the numeric input. Units are presentation only, not stored values.

Collection text/textarea controls commit on blur (single-line controls also on
Enter); structured Rich Text commits as it is edited. Rejected drafts retain
their text and an associated validation error without changing the Document.
Escape restores the accepted value, and Undo or a controlled Host replacement
clears stale drafts. Schemas remain the authority for accepted values.

The React renderer supplies `ElementRenderContext.elementId`, an optional stable
Document Element identity, so definitions can give interactive descendants
deterministic IDs without depending on editable anchors. Existing render-context
callers may omit it. The standard Menu uses it to link its disclosure to its
panel. Menu layout honors the Document's breakpoint settings during SSR and
receives the renderer's `styleNonce`; it needs no Host stylesheet repairs.
`PagebldrRuntimeInteractions` activates the same markup in the isolated canvas
and published page: dropdown boundary positioning, fullscreen layout, dismissal,
focus management, scroll restoration and anchor navigation remain package-owned.
The presentation-only renderer itself still requires no browser globals.

Every standard Element accepts an optional authored anchor ID. The Advanced
inspector normalizes input to a unique lowercase ASCII slug of at most 80
characters, preserves duplicate drafts for correction, and makes valid anchors
immediately available to Destination controls.

## Errors and compatibility

All package errors carry a stable code, human message, optional location, and
safe details. Error messages themselves are not compatibility contracts. Public
exports are maintained through explicit package `exports`, an API-extractor or
equivalent snapshot, and compile fixtures for supported TypeScript/React
combinations.
