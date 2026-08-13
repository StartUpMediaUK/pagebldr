# Package and release foundations

Research checked 12 August 2026. Sources are official project documentation,
first-party repositories, standards bodies, or the npm registry itself.

## Package identity

- `https://registry.npmjs.org/pagebldr` returned HTTP 404 on 12 August 2026, so
  the unscoped `pagebldr` name appears unregistered **at the time of the
  check**. This is not a reservation or guarantee: recheck immediately before
  the first publish, and secure the name early with a legitimate minimal release
  if npm policy and project readiness permit.
- Prefer the unscoped package if it can be secured: it gives the intended
  `npm install pagebldr` experience. Keep an organization scope (for example,
  `@startupmedia/pagebldr`) as the collision/governance fallback. npm notes that
  scoped packages are private by default and require `--access public` for a
  public first publish; set `publishConfig.access: "public"` so CI does not rely
  on operator memory.
  [npm: scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- A scope changes the install/import name and ties naming administration to the
  npm organization. It does not require splitting the repository or changing the
  package architecture.

## Workspace and package shape

- Use a pnpm workspace with the publishable library and integration examples as
  separate projects (for example, `packages/pagebldr`, `examples/vite-react`,
  and `examples/next`). A workspace requires `pnpm-workspace.yaml`. Use
  `workspace:` for internal packages: pnpm guarantees local resolution during
  development and rewrites those references to ordinary semver specifications
  when packing/publishing. [pnpm workspaces](https://pnpm.io/workspaces)
- Publish only the package project, not example applications. pnpm supports
  `publishConfig` overrides and `publishConfig.directory`; recursive publishing
  publishes every workspace package whose version is absent from the registry,
  so examples must remain `private: true` and release automation should
  explicitly filter the publishable package. Always inspect
  `pnpm pack --dry-run`/the tarball before release.
  [pnpm publish](https://pnpm.io/cli/publish)
- Vite library mode is appropriate for the browser-facing build. It supports
  multiple entries and ES/CJS formats; externalize React/React DOM, expose
  deliberate subpaths through `package.json#exports`, ship declarations, and
  expose package CSS as an explicit export. Vite also supports a dedicated CSS
  output name.
  [Vite library mode](https://vite.dev/guide/build.html#library-mode),
  [Vite build options](https://vite.dev/config/build-options.html#build-lib)
- Keep the Vite demo as a real consumer importing package exports, not
  source-relative internals. This tests the same public surface third parties
  receive.

## React and framework compatibility

- Declare `react` and `react-dom` as peer dependencies, not bundled
  dependencies, to avoid duplicate React runtimes. A practical initial range is
  `^18.3.0 || ^19.0.0`, mirrored in peer dev dependencies/tests. React
  explicitly identifies 18.3 as the warning bridge to React 19, while its
  library compiler example demonstrates multi-major peer ranges.
  [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide),
  [compiling libraries](https://react.dev/reference/react-compiler/compiling-libraries)
- Test both supported majors in CI, including types. React 19 changes `ref`
  handling, requires the modern JSX transform, and deprecates
  `react-test-renderer`; use Testing Library/browser-oriented tests instead. Do
  not depend on React internals.
  [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- Keep renderer/schema/config modules free of `window`/DOM access where
  possible. Put editor-only code behind an explicit client entry and preserve
  `"use client"` at entry points that use state, effects, browser APIs, or
  client-only third-party components. Next.js gives this exact guidance to
  component-library authors.
  [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components#third-party-components)
- Verify the packed artifact in an App Router example. A correctly built npm
  package should not require `transpilePackages`; that option is useful as a
  diagnostic/local-workspace escape hatch because Next can transpile local or
  external packages, not as the default consumer setup.
  [Next.js `transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)

## Releases, trusted publishing, and provenance

- Use Changesets for explicit patch/minor/major intent, changelogs, and
  coordinated workspace dependency updates. pnpm itself says workspace
  versioning is not built in and identifies Changesets as a supported release
  tool. [pnpm release workflow](https://pnpm.io/workspaces#release-workflow),
  [Changesets introduction](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
- For an alpha/beta line, use a dedicated prerelease branch and
  `changeset pre enter <tag>`; then run the normal version/publish process. The
  tag becomes both the version suffix and npm dist-tag. Exit using
  `changeset pre exit`, then version and publish stable. Changesets warns that
  prereleases remove safety rails and recommends not running them from the
  default branch because they can block unrelated stable changes.
  [Changesets prereleases](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- Use npm trusted publishing from a public GitHub repository on GitHub-hosted
  Actions. It uses OIDC rather than a long-lived write token and requires
  `id-token: write`; npm currently requires npm CLI 11.5.1+ and Node 22.14.0+
  for trusted publishing. Match `repository.url` and the configured workflow
  filename exactly.
  [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- Trusted publishing automatically creates provenance for public packages built
  from public repositories on supported GitHub/GitLab hosted runners. Provenance
  links the artifact to source/build metadata; it does **not** prove the code is
  safe. Consumers can verify signatures and attestations with
  `npm audit signatures`.
  [npm provenance](https://docs.npmjs.com/generating-provenance-statements/),
  [viewing provenance](https://docs.npmjs.com/viewing-package-provenance/)
- Bootstrap caveat: npm's CLI trust command requires the package already to
  exist. Plan an authenticated, 2FA-protected first publish, then configure the
  trusted publisher, verify one OIDC release, restrict traditional token
  publishing, and revoke obsolete automation tokens.
  [npm `trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/)

## Accessibility release baseline

- Treat WCAG 2.2 Level AA as the product target, covering editor and rendered
  output. Automated checks are necessary but insufficient: axe-core reports that
  it finds about 57% of WCAG issues automatically and returns uncertain cases
  for manual review. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/),
  [axe-core](https://github.com/dequelabs/axe-core)
- Unit/component baseline: semantic queries and interaction tests with Testing
  Library; axe checks on every stable editor state (canvas, selection, dialogs,
  menus, controls, validation, preview). Do not rely on JSDOM alone: axe
  documents limited JSDOM support and specifically says color contrast does not
  work there.
  [axe-core support notes](https://github.com/dequelabs/axe-core#supported-browsers)
- Browser baseline: run axe in a real browser for representative editor and
  renderer flows, including states revealed after interaction. Add manual
  keyboard-only review (logical focus order, visible focus, escape/close
  behavior, no traps, drag/drop alternative), screen-reader smoke tests,
  zoom/reflow, forced-colors/high-contrast, reduced motion, and contrast review.
  Axe only checks rendered content, so inactive dialogs/menus must be opened and
  retested.
  [axe-core API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)

## License choice

- Both MIT and Apache-2.0 are OSI-approved permissive licenses. MIT is short and
  permits use, modification, distribution, sublicensing, and sale, conditioned
  on retaining copyright/license notices, with an as-is warranty/liability
  disclaimer. [OSI MIT text](https://opensource.org/license/mit)
- Apache-2.0 is longer and adds explicit patent-license terms, patent-litigation
  termination, contribution terms, and rules for preserving
  notices/modified-file statements. If the work includes a `NOTICE` file,
  downstream distributions must preserve its relevant attribution notices as
  section 4 describes.
  [Apache-2.0 text](https://www.apache.org/licenses/LICENSE-2.0),
  [ASF application guidance](https://www.apache.org/legal/apply-license)
- Recommendation: choose **MIT** for the lowest-friction, familiar React-library
  posture unless the copyright owner specifically wants Apache-2.0's express
  patent grant and termination protection. Choose **Apache-2.0** if that patent
  clarity outweighs the extra compliance surface. Before relicensing extracted
  Quizr code, confirm Startup Media/Quizr owns every relevant contribution and
  asset; a new repository cannot erase upstream third-party license obligations.
  This is project guidance, not legal advice.

## Recommended initial decisions

1. Attempt to secure unscoped `pagebldr`; retain a documented scoped fallback.
2. pnpm workspace, one publishable package, private Vite and Next consumer
   examples.
3. ESM-first package with explicit exports, declarations and CSS export; add CJS
   only if verified consumers require it.
4. React/React DOM peers `^18.3.0 || ^19.0.0`, tested against both.
5. Changesets stable releases from the default branch; prereleases from a
   dedicated branch and non-`latest` dist-tag.
6. GitHub Actions trusted publishing and automatic provenance after the first
   manual bootstrap publish.
7. WCAG 2.2 AA target with Testing Library, axe in components and real browsers,
   plus manual keyboard/screen-reader checks.
8. MIT by default, subject to a clean source-ownership and third-party-license
   audit.
