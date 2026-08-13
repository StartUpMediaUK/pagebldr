# Public interface proposal

Status: proposed; names are intentionally not frozen until the owner decisions
are resolved and a compile-tested prototype proves inference quality.

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

Proposed editor properties:

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
  composition?: EditorComposition;
  capabilities?: Partial<EditorCapabilities>;
  className?: string;
}
```

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
  resourceContext={requestContext}
/>
```

The renderer validates/migrates at a clearly documented entry point. A
prevalidated form may be exposed for high-volume rendering only after
measurement.

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
  controls?: readonly ControlContribution<Props>[];
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

## Errors and compatibility

All package errors carry a stable code, human message, optional location, and
safe details. Error messages themselves are not compatibility contracts. Public
exports are maintained through explicit package `exports`, an API-extractor or
equivalent snapshot, and compile fixtures for supported TypeScript/React
combinations.
