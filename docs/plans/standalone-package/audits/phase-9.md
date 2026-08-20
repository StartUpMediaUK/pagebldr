# Phase 9 audit — product-neutral examples

Status: complete; accepted by the product owner. Date: 2026-08-20.

## Outcome

All four product-neutral examples are implemented against public package
exports. Vite demonstrates controlled localStorage persistence, fake asset and
application-link Resources, edit/preview routes, Contributions, and the
production renderer. Next.js demonstrates a Host-owned catch-all Runtime route,
metadata, SSR rendering, a client-only editor, Visit collection, and a
Host-owned interaction endpoint without `transpilePackages`.

The custom Elements example registers a third-party Element, Controls, Block,
Template, Style capability, reference extractor, migration, Resource adapter,
and renderer. Custom persistence demonstrates callbacks and optional server
orchestration with permissions, Host notifications, optimistic versions,
Revisions, publication, and observable integration/Provider identity.

## Changed interfaces

- `pagebldr/react/server` is an SSR-safe presentation-only renderer subpath.
- `PagebldrRenderer` implementation is isolated from the client editor bundle
  while remaining exported from `pagebldr/react` for ordinary React Hosts.

## Verification performed

- Full `pnpm check`: formatting, lint, TypeScript, tests, builds, package export
  validation, packed-consumer validation, and licence checks.
- Next.js 16.3 production build passed with Turbopack and no
  `transpilePackages`; `/welcome`, `/edit`, and the Host analytics route were
  emitted.
- Vite production build and both TypeScript example builds passed.
- `git diff --check` passed.
- Collaborative-browser navigation loaded the Vite application, the Next.js
  published route with Runtime metadata, and the Next.js editor route.

## Deferred work and risks

- The collaborative preview's snapshot and click automation failed again, so a
  complete recorded edit/save/preview and interaction-post flow remains pending
  rather than being represented as passed.
- Workspace examples resolve the same built public artifacts and the packed
  consumer validates the tarball, but a future release matrix should install
  that tarball independently into each example before publication.
- The optional Next.js and React skill files advertised by the runtime were
  absent from the installed plugin cache. Official Next.js documentation was
  used for the current App Router contract.

## Commit

`597c8b2` (`feat: add product-neutral examples`).

The product owner accepted the phase and directed work to continue to Phase 10
on 2026-08-20.
