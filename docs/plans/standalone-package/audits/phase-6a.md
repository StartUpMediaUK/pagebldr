# Phase 6A audit — production Runtime and events

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The production Runtime now normalizes Host paths, resolves scoped Publications,
validates and migrates Documents, prepares Resources, derives metadata,
canonical URLs and cache identities, and returns explicit found, redirect,
not-found, or isolated-error outcomes.

Audit and Analytics use distinct schema-versioned envelopes delivered only to
Host-configured sinks. Delivery owns monotonic ordering, unique IDs, scalar
redaction, batching, bounded retry, consent gating, and configurable failure
isolation. No package-owned endpoint or infrastructure exists.

## Changed interfaces

- `createPagebldrRuntime()` exposes `resolve()` and `recordVisit()`.
- `PagebldrPage` bridges a prepared Published page to the SSR-safe renderer and
  consent-aware client Visit/Interaction collection.
- `pagebldr/runtime/next` provides metadata, cache-tag, and route-result
  helpers; it imports no Next.js runtime and owns no application route.
- Event delivery supports memory, callback, console, Audit-store, and
  OpenTelemetry-style sinks.
- `recordEditorAudit()` emits semantic editor action metadata without authored
  content.
- Server lifecycle mutations can emit Actor/Scope-aware Audit events.
- `createAuditQuery()` requires Host authorization and Host scope resolution
  before returning a paginated Audit page.

## Verification performed

- Path/query/trailing-slash normalization, scoped lookup, redirect, not-found,
  canonical URL, metadata, cache identity, and error outcomes.
- Event schema version, ordering, unique IDs, redaction, consent rejection,
  batching, bounded retry, retry exhaustion, and sink isolation/propagation.
- Memory Audit persistence, scope filtering, pagination, and authorized Host
  querying.
- Server mutation Audit Actor and Scope propagation.
- Explicit capability failure when transactional Audit is requested from an
  adapter that cannot atomically append it; memory and current Prisma adapters
  truthfully advertise this as unsupported rather than weakening the guarantee.
- Semantic renderer actions are definition-owned; no arbitrary global DOM
  listener or capture is installed.
- Full repository and packed-consumer gates are required before commit.

## Deferred work and risks

- A Provider may advertise transactional Audit only after its Audit rows and
  lifecycle mutation share the same adapter transaction and pass real-provider
  conformance. Current adapters fail this request explicitly.
- Storage-backed Audit persistence beyond the generic `AuditEventStore` seam is
  Host implementation until a Provider target proves the atomic guarantee.
- Browser hydration and interaction accessibility are exercised with the full
  editor/browser matrix in Phase 7 and release compatibility phases.
- No deployment, publication, push, or external-system change occurred.

## Commit

To be recorded after product-owner review and authorization.
