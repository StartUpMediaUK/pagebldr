# Foundation decisions

Status: Phase 0 decisions resolved on 2026-08-13. External publishing and
deployment remain separately authorized actions.

## Resolved

- **Repository**: the existing public repository is `StartUpMediaUK/pagebldr`;
  local `origin` points to it.
- **npm identity**: target unscoped `pagebldr`. The registry returned HTTP 404
  on 2026-08-13, which is not a reservation; recheck immediately before the
  authorized bootstrap publish. Fallback: `@startupmedia/pagebldr` if the name
  cannot be secured.
- **Support floor**: React and React DOM peers `^18.3.0 || ^19.0.0`; Node 20+
  for ordinary development/tooling; a release runner meeting current npm
  trusted-publishing requirements; modern evergreen editor browsers; SSR
  renderer support in maintained React runtimes.
- **Schema interface direction**: prototype a Standard Schema-compatible public
  seam in Phase 2 while retaining Zod as an allowed implementation dependency.
  Phase 2 compile fixtures must prove inference before the interface freezes.
- **UI foundation**: package-owned shadcn primitives, ReUI compositions where
  appropriate, and compiled CSS with no consumer Tailwind/shadcn/ReUI
  requirement.
- **Installed product**: `pagebldr` ships a complete pre-styled Default
  experience. Hosts may theme and extend it through documented seams, but do not
  perform a presentation pass or rebuild standard features after installation.
- **Reference Host**: `examples/vite-basic` is the primary visual and
  interaction acceptance surface. Completion evidence must use a freshly packed
  artifact, public exports, package CSS and the standard preset; Host styling or
  custom Contributions cannot repair the default route.
- **Backend boundary**: optional server lifecycle, Provider-aware Storage
  adapters, Host-operated APIs/routes, production Runtime, and Host Event sinks.
- **Docs stack**: private `apps/docs` workspace using Next.js 16, Fumadocs
  MDX/Core/UI, Tailwind 4, and Orama search; no initial AI chat.
- **Licence and source ownership**: MIT. The product owner confirmed Startup
  Media owns the Quizr builder implementation in its private SaaS repository and
  authorizes its extraction and open-source relicensing.
- **Documentation deployment**: use the Startup Media Vercel organization and
  proposed project name `pagebldr-docs`; deployment and custom-domain selection
  are deferred until separately authorized.
- **Browser policy**: alpha supports the latest two major versions of Chrome,
  Edge, Firefox, and Safari, current Safari on iOS, and current Chrome on
  Android. Internet Explorer is unsupported. Reassess the matrix before beta.

## Deferred operational decisions

1. Recheck and secure the npm name only when bootstrap publishing is authorized.
2. Select the docs production domain when deployment is authorized.
3. Reassess browser telemetry and the explicit support matrix before beta.

## Proposed defaults

Phase 1 scaffolding is authorized to begin locally. Repository creation, pushes,
npm publication, and Vercel deployment remain separate external actions.
