# Owner decisions before scaffolding and remote creation

No remote repository, npm package, licence, or support promise should be created until these decisions are explicit.

## Required decisions

1. **GitHub owner and incubation visibility** — confirm `joshuag-startupmedia/pagebldr` (or an organization-owned alternative) and whether the repository starts public or private until the first alpha. The product goal requires public visibility by open-source launch.
2. **npm identity** — prefer unscoped `pagebldr` if registry availability and ownership are confirmed at publish time; otherwise choose an organization scope such as `@startupmedia/pagebldr`. The repository name can remain `pagebldr` either way.
3. **Licence** — choose MIT for minimum conditions and ecosystem familiarity, or Apache-2.0 for its explicit patent grant/termination terms. Do not add a licence file until chosen.
4. **Support floor** — proposed: React/React DOM `^18.3 || ^19`, Node 20+ for ordinary development/tooling (with a newer release runner where npm trusted publishing requires it), modern evergreen browsers for the editor, and SSR renderer support in maintained React runtimes. Confirm the browser policy and whether Node 20 remains acceptable in 2026.
5. **Schema dependency** — choose direct Zod exposure for best near-term inference/source compatibility, or prototype a Standard Schema-compatible public contract to avoid locking extension authors to one Zod major.

## Proposed defaults

The UI and Host-integration decisions are now resolved: use package-owned shadcn primitives with ReUI as the preferred higher-level registry source, compiled package CSS with no consumer Tailwind requirement, and no Quizr/Tener compatibility or privileged adapters. The remaining proposed defaults are a single published `pagebldr` package with subpath exports, an internal core/react workspace split, a controlled editor, generic Resource adapters, MIT unless patent language is important to Startup Media, and React 18/19 peers.
