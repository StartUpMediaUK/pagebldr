# Phase 2 audit — public-interface tracer

Status: complete locally; awaiting product-owner review. Date: 2026-08-13.

## Outcome

The tracer validates the proposed package seams through executable minimal
implementations. One install exposes core, controlled React, framework-neutral
server, runtime, and memory-adapter subpaths. The implementation contains no
product-specific vocabulary, framework-owned routes, database provider, or
browser dependency in server code.

## Changed interfaces

- `pagebldr`: `createPagebldr`, `defineElement`, Standard Schema v1 types,
  minimal Documents, Resource contracts, prepared Resources, and coded errors.
- `pagebldr/react`: controlled `PagebldrEditor`, presentation-only
  `PagebldrRenderer`, change events, and save/publish intent contracts.
- `pagebldr/server`: Storage integration/provider identity, explicit capability
  declarations, single/multiple Collection policy, and minimal save lifecycle.
- `pagebldr/runtime`: Host-supplied publication lookup and found/not-found route
  resolution with prepared metadata and Resources.
- `pagebldr/adapters/memory`: a development Storage adapter that explicitly
  declares both its integration and Provider.

`createPagebldr()` validates namespaces and Resource keys and refuses duplicate
Element registrations at construction. It exposes read-only definition maps, not
mutable registry objects or registry orchestration.

## Schema decision

The public schema seam uses Standard Schema v1. A direct Zod schema retains
inference across Element defaults, migrations, controls, and references, while
Zod remains an optional Host choice instead of a package runtime dependency.

## Verification performed

- Strict TypeScript inference fixtures for Zod/Standard Schema Elements.
- Unit tests for configuration rejection, controlled SSR rendering, Storage
  capabilities/provider identity, and Runtime publication resolution.
- `pnpm format:check`, ESLint, TypeScript, Vitest, build, Publint, Are the Types
  Wrong, dependency-licence inventory, and `git diff --check` through the root
  quality gate.
- A clean temporary consumer installs the packed tarball, compiles Vite-shaped
  client and Next-shaped server/runtime integrations, and imports all five
  public entry points under Node ESM.
- The packed React entry retains its bare React import, proving React is
  externalized. The server entry imports successfully in Node without browser
  globals.

## Deferred work and risks

- Tracer Documents and save behavior are deliberately non-persistent and will be
  replaced by the Phase 3 kernel and later server lifecycle phases.
- Full Vite and Next production builds, React 18/19 matrix tests, styles, and
  browser accessibility checks remain assigned to later applicable phases.
- ESM-only packaging remains deliberate; CommonJS `require()` is unsupported.
- No package publication, deployment, or external system change was performed.

## Commit

To be recorded after product-owner review and authorization.
