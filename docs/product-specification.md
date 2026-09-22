# Product specification

## Purpose

`pagebldr` lets a React Host install and immediately embed a complete, polished
visual page builder and render the resulting document in production without
adopting a CMS, database, backend, tenancy model, or publishing workflow.

The success measure is integration leverage: a Host should learn one small
interface and receive the finished editor presentation, standard features and
tools, document safety, editing behavior, rendering, styling and migrations from
the package. Installing `pagebldr` must not start a new presentation pass or
require the Host to reconstruct the Quizr-derived experience.

## Package responsibilities

The package owns:

- the normalized, schema-versioned Document format and serialization;
- structural validation and deterministic document and Element migrations;
- command-only mutations, patches, Local history, and clipboard behavior;
- responsive and interaction-state styles, design variables, reusable classes,
  and deterministic CSS compilation;
- coherent Element definitions and registries for Elements, Controls, Blocks,
  Templates, and Style capabilities;
- visual editor state, interactions, accessible editing UI, preview/read-only
  modes, and a configurable editor shell;
- the complete Default experience, including its layout, responsive behavior,
  visual styling, standard toolbar, libraries, Structure, inspectors, dialogs,
  selection chrome, empty/loading/error states and interaction feedback;
- standard atomic Elements and the same rendering definitions for editor and
  production use;
- an SSR-capable React renderer and package-owned CSS with theme custom
  properties.
- optional server-side Document persistence orchestration, adapter conformance,
  optimistic concurrency, durable Revisions, and publication state.
- schema-versioned Audit and Analytics events plus Host-configurable Event
  sinks;
- a route-oriented production Runtime that resolves Published pages, prepares
  Resources/metadata, renders through React, and instruments Visits and
  Interactions.

The Host always owns:

- transport and API runtime/load, deployment, authentication, authorization,
  tenancy/scope resolution, and autosave policy;
- selection and provisioning of a database, ORM client, Provider-specific
  schema/migration deployment, and whether to use the optional server module;
- resource storage and application-specific validation;
- application navigation, notifications, event retention/querying/export,
  privacy/consent policy, and the screen surrounding the editor.

Host ownership of the surrounding screen does not make the internal editor
presentation a Host responsibility. A Host may theme documented tokens and add
documented Contributions, but the installed default must need no redesign,
replacement controls or Host CSS repairs.

The package requires no backend for local or callback-controlled use. For
standardized persistence it exposes an optional framework-neutral server module
plus Storage adapters. It does not host an API or database. Hosts mount optional
handlers or call the server module through their own server actions, REST,
GraphQL, tRPC, jobs, or other transport and bear all resulting load and
operational responsibility.

## Required behavior

1. A valid Document round-trips without loss and renders deterministically.
2. Older supported Documents migrate deterministically before use. Future
   schemas and missing migration steps fail explicitly.
3. Element migrations are defined alongside Element definitions and run
   independently of Document schema migrations.
4. Every mutation crosses the command interface and produces history patches;
   consumers do not mutate package state directly.
5. Local history never implies or manages durable Host Revisions.
6. Blocks and Templates create normal editable Element trees.
7. Unknown or unavailable Element definitions fail validation for editing;
   production rendering follows an explicit Host-selected policy rather than
   silently guessing.
8. Editor and production rendering use the same Element definition renderer so
   their behavior cannot drift through separate type switches.
9. The production renderer can run under SSR without a browser global. The
   visual editor is a client module.
10. The editor is built from package-owned shadcn primitives and ReUI
    compositions, then distributed with compiled package CSS. Consumers need
    neither Next.js, Tailwind, ReUI, nor a host shadcn installation.
11. Authoring and server operations emit durable Audit events; published-page
    Visits and Interactions emit separate consent-aware Analytics events.
12. A Host can resolve and display a Published page at a route without
    rebuilding publication lookup, Resource preparation, metadata,
    instrumentation, or renderer orchestration.
13. Importing the package stylesheet and mounting the standard preset produces
    the complete Default experience; no Tailwind setup, copied components,
    custom layout or feature assembly is required.
14. The repository's Reference Host consumes a freshly packed artifact through
    public exports and demonstrates every standard feature with realistic local
    adapters in a browser.
15. A feature is not complete until its installed presentation and full
    interaction can be visually audited in the Reference Host at all supported
    editor viewport classes.
16. The Reference Host must not use Host CSS, custom Contributions or internal
    imports to repair or complete the standard editor. Extension examples live
    on separate routes and cannot substitute for the Default experience.

## Integration acceptance scenarios

- The Vite Reference Host installs a freshly packed `pagebldr` artifact, imports
  `pagebldr/styles.css`, mounts the standard preset with minimal documented
  wiring, exercises every standard tool and renders the result on a separate
  published route.
- A fresh consumer can reproduce the Reference Host's Default experience from
  the installation guide without copying source, adding editor CSS or designing
  missing UI.
- A Next.js app server-renders a published Document and mounts the editor only
  on a client route.
- A Vite router and a Next.js catch-all page both resolve Published pages
  through the same Runtime, while their Host applications retain route
  ownership.
- Quizr and Tener send identical package events to different Host Event sinks
  and query them through their own developer tooling.
- A Host uses a controlled Document and rejects a save because its optimistic
  revision is stale; the editor surfaces the Host error without owning conflict
  policy.
- A Host registers an application-link Resource kind and a custom Element that
  extracts and resolves those references; `pagebldr` contains no knowledge of
  that product.
- Two editor presets place the same library, structure, inspector, and canvas
  Contributions in materially different arrangements without internal imports.
- Quizr, Tener, and an unrelated application each install the same package and
  integrate through the same public callbacks, Resource adapters, Element
  definitions, and Contributions; package code contains no privileged product
  path.

## Non-goals for the first prerelease

- collaboration or multiplayer editing;
- a hosted database, hosted API, hosted asset service, or deployment product;
- a hosted Revision service; the package may provide the standard Revision UI
  when a Host supplies the lifecycle capability;
- arbitrary replacement of internal implementation details;
- migration or compatibility code for a specific Host's pre-package document
  format;
- a stable plugin ABI outside the typed registration seams documented here.

## Release criteria

Alpha requires the engine, renderer, standard definitions, controlled editor,
default preset, package-native fixtures, deterministic migrations and the
Reference Host demonstrating the complete installed Default experience from a
packed artifact. Beta additionally requires the Next.js and custom-extension
examples, alternate editor preset, accessibility and browser coverage,
performance fixtures, and complete product-neutral integration documentation.
