# Phase 4A audit — server lifecycle and Storage adapters

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The optional framework-neutral server lifecycle is implemented. Hosts can use
load, list, create, save, delete, Revision restore, publish, and unpublish
operations without delegating authentication, authorization, routing, runtime
load, or deployment to pagebldr.

Memory, Prisma PostgreSQL, and Prisma MongoDB adapters implement the same
Provider-aware Storage contract. The Prisma providers are distinct targets with
their own setup guidance and schema fragments; MongoDB explicitly requires a
replica set for transactional lifecycle operations.

## Changed interfaces

- `pagebldr/server` exports `createPagebldrServer`, Storage contracts,
  capability negotiation, Collection policy, and lifecycle request/result types.
- `pagebldr/server/next` exports a fetch-standard handler factory whose Host
  supplies authorization and scope resolution.
- `pagebldr/adapters/memory` provides an ephemeral, atomic development adapter.
- `pagebldr/adapters/prisma` provides explicit `postgresql` and `mongodb`
  factories plus a structural Prisma-client assertion.
- The package includes PostgreSQL and MongoDB Prisma model fragments for Hosts
  to merge into their own schemas and migrate using their normal workflow.
- Core errors now distinguish unavailable capabilities, optimistic conflicts,
  and missing records.

The Collection policy supports either one fixed page key or multiple pages.
Scope remains an opaque Host-owned record and contains no tenancy policy.

## Verification performed

- Shared conformance coverage for lifecycle behavior, optimistic conflicts,
  Revision ordering and restoration, publication pointers, deletion, pagination,
  scope isolation, transaction rollback, and single-page policy.
- Unsupported adapter capabilities fail before lifecycle work begins.
- The Host-mounted handler was verified to run authorization and scope
  resolution while producing the same stored state as direct server calls.
- PostgreSQL 17 and MongoDB 8 were started as disposable Docker services. The
  Prisma schemas were generated and pushed, MongoDB was configured as a replica
  set, and all 13 memory/provider/handler integration tests passed against the
  real databases.
- Repository formatting, lint, TypeScript, complete unit-test, build, package
  analysis, packed-consumer, licence, and diff gates pass.

## Deferred work and risks

- Drizzle targets are deferred until a dialect can demonstrate the same
  lifecycle guarantees; no unverified Drizzle Provider is advertised.
- Transactional Audit event persistence lands with the event contracts in Phase
  10; the capability is present so adapters cannot silently weaken that seam.
- The Next handler deliberately does not own rate limiting, authentication,
  authorization policy, routes, or deployment.
- Hosts remain responsible for applying and evolving provider schemas. The
  package does not run migrations against Host databases.
- No package-operated API, deployment, publication, push, or other external
  system change occurred.

## Commit

To be recorded after product-owner review and authorization.
