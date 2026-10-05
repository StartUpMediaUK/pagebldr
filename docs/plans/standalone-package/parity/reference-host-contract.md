# Reference Host contract

Status: accepted Phase 0 contract; packed build enforcement and core-engine
probe routes began in Parity Phase 1. Remaining routes and seeded states arrive
with the phases that own their behavior.

`examples/vite-basic` is the Reference Host. It is an installed-product test
surface that happens to be runnable by humans, not a simplified tutorial or a
place to compensate for missing package behavior.

## Consumption modes

### Source mode

Source mode gives package maintainers fast feedback while developing. It may
resolve workspace packages and use hot reload. Source mode is never completion
evidence by itself.

### Packed mode

Packed mode is authoritative:

1. build the publishable package;
2. create a fresh tarball;
3. install that tarball and supported React dependencies into an isolated
   Reference Host workspace;
4. build and start the application without workspace aliases;
5. expose the installed package version and tarball SHA-256 in an audit-only
   information surface;
6. run browser journeys against that server; and
7. retain screenshots, traces and console/network diagnostics with the phase
   audit.

Packed mode fails if the app imports an internal workspace path, reaches source
files outside the installed package or requires consumer Tailwind processing.

For local browser acceptance, build the package, then run
`scripts/check-packed-package.mjs` with `PAGEBLDR_KEEP_PACKED_REFERENCE_HOST=1`.
The checker reports and retains its isolated workspace instead of deleting it.
Run the installed Vite CLI with `preview` from the reported Reference Host
directory. Its built `/packed-artifact.json` audit surface exposes the installed
package and React versions, tarball name and SHA-256. Normal checks still clean
up automatically; retained workspaces are temporary local evidence and are not
repository source.

## Default-route purity

The default route proves what every developer receives. It may contain only:

- public `pagebldr` exports;
- `pagebldr/styles.css`;
- the standard Builder configuration and standard preset;
- the documented controlled state/lifecycle wiring;
- product-neutral local Adapters; and
- minimal page-level CSS for the outer application viewport only.

It must not contain:

- custom Contributions;
- copied or replacement editor controls;
- selectors targeting editor internals;
- CSS that repairs editor layout, spacing, colors, typography or responsive
  behavior;
- direct access to internal registries, stores, DOM structure or canvas
  messages; or
- conditional behavior available only to the Reference Host.

An automated purity check must scan the default route and its imported styles.
Extension demonstrations live on a separate route.

## Route and state inventory

Hash routes keep the Vite Host dependency-light. Equivalent path routing may be
adopted later without changing the required states.

| Route          | Required state                                                             |
| -------------- | -------------------------------------------------------------------------- |
| `#/editor`     | Default mutable editor, seeded with `project-enquiry.document.json`.       |
| `#/preview`    | Current local Document through the package preview workflow.               |
| `#/published`  | Published snapshot through the Runtime and production renderer.            |
| `#/readonly`   | Complete editor in read-only policy with an explanatory reason.            |
| `#/history`    | Seeded local Actions and durable Revisions with a live Revision.           |
| `#/conflict`   | Preserved local changes in optimistic conflict state.                      |
| `#/recovery`   | Valid local recovery offer and discard/recover paths.                      |
| `#/empty`      | Valid minimal Document and empty-library/resource states.                  |
| `#/errors`     | Deterministic load, Resource, save and publication failures.               |
| `#/extensions` | Custom Element and Contribution examples, isolated from the default route. |

Direct links must reproduce each state after a reload so the product owner can
audit it without executing hidden setup steps.

## Local Adapter capabilities

The Reference Host supplies realistic product-neutral Adapters; the package
still owns the orchestration and presentation.

| Adapter           | Required capabilities                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle         | Load, serialized autosave, explicit save, expected revision, publish/update, unpublish, list/preview/restore Revisions, idempotent operation IDs and deterministic conflict/failure controls. |
| Resources         | Browse, search, filter, sort, single/multiple selection, upload progress/cancel/retry, external URL, unavailable items and previewable image/video records.                                   |
| Saved Blocks      | List, create with an 80-character name limit, delete and enforce a 50-item cap.                                                                                                               |
| Managed Templates | List assigned templates and load a complete Document; include both assigned and unassigned records to prove filtering.                                                                        |
| Destinations      | Resolve product-neutral application links and return a deliberately broken reference for validation states.                                                                                   |
| Events            | Capture Audit and consent-aware Analytics events in memory for observable verification without sending network telemetry.                                                                     |

The local Adapters must use the same public interfaces available to real Hosts.

## Seed data

- Default Document: `fixtures/parity/project-enquiry.document.json`.
- Element inventory: `fixtures/parity/all-elements.document.json`.
- Style engine probe: `fixtures/parity/responsive-states.document.json`.
- Resources: at least twelve images, four videos, one unavailable image and one
  invalid external URL; all locally deterministic and licensed for repository
  use.
- Revisions: save, publish and restore kinds; one live Revision and at least one
  older restorable Revision.
- Library: all standard Blocks/Templates, two saved Blocks and two assigned
  managed Templates.

## Browser evidence

Every parity phase adds its observable behavior to this Host during the same
phase. Its audit records:

- tarball name, package version and SHA-256;
- browser and exact viewport;
- route and seeded state;
- before/after screenshots for material interactions;
- the interaction trace ID;
- console errors and failed network requests;
- automated accessibility results where applicable; and
- a manual keyboard result for changed interactive behavior.

A screenshot of an idle control is insufficient when the requirement describes
an interaction. The trace must reach the observable outcome.
