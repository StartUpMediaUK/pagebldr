# Releasing pagebldr

Only `packages/pagebldr` is published. Documentation and examples remain private
workspace consumers. Preparing a candidate does not authorize a commit, push,
npm publish or docs deployment. Obtain product-owner review before each release.

## Local candidate

Use a supported Node version and pnpm 10.8.0. Start from the intended source
commit, install the frozen lockfile and run:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm audit --audit-level high
New-Item -ItemType Directory -Force release-evidence | Out-Null
$env:PAGEBLDR_KEEP_PACKED_REFERENCE_HOST='1'
$env:PAGEBLDR_CHECK_PACKED_NEXT='1'
$env:PAGEBLDR_PACKED_RESULT="$PWD/release-evidence/packed.json"
node scripts/check-packed-package.mjs
node scripts/run-packed-browser.mjs release-evidence/packed.json release-evidence/browser chromium full
node scripts/prepare-alpha-release.mjs release-evidence/packed.json release-evidence/distribution 0.0.0-alpha.0
node scripts/verify-alpha-candidate.mjs release-evidence/distribution/release.json 0.0.0-alpha.0
```

Replace the final version with the exact reviewed version. The preparation
script copies the tested archive, checks its SHA-256 and writes a release
manifest. It rejects stable versions, non-alpha channels, versions outside 0.x,
private packages and mismatched version approvals. It never publishes.
`release-evidence/` is ignored local output; attach the selected evidence to the
reviewed release record or CI artifact.

The browser runner installs pinned Playwright/axe tooling only inside the clean
consumer, starts its built Hosts on available ports, runs the journeys and stops
its servers. On Linux CI set `PAGEBLDR_INSTALL_BROWSER_DEPS=1` to install
browser system requirements. `PAGEBLDR_SKIP_BROWSER_INSTALL=1` reuses existing
browser binaries locally; `PAGEBLDR_CHROMIUM_EXECUTABLE` selects a compatible
local Chromium executable.

Run the packed checker separately with `PAGEBLDR_REACT_VERSION=18.3.1` for React
18; use a separate result file and evidence directory. CI additionally exercises
Firefox and WebKit responsive authoring. The full Chromium suite includes Vite,
the packed Next.js Host, root-entry navigation, published widgets, pencil
movement, keyboard, libraries and lifecycle recovery. Browser tests assert
current behavior and capture screenshots; they are not a pixel-difference
certification against every historical source screenshot.

`PAGEBLDR_VISUAL_BASELINE` enables comparison against the accepted editor-canvas
captures in `fixtures/visual/editor-canvas`. `etc/canvas-visual-regions.json`
defines the upper 430px editor regions and separate 24px pencil targets. This
excludes a remote authored image whose earlier capture was partially loaded.
Baselines are never rewritten; reports disclose the exact regions and
changed-pixel ratios. Windows CI uses the same platform family as those
captures. Broader pixel parity remains a documented limit.

## Public interface review

`pnpm check` compares compiled public declarations with `etc/public-api.json`.
After an intentional interface change, run `pnpm api:update`, review the diff
and add a package Changeset. PR CI compares that baseline with the base revision
and requires a Changeset for a changed interface or shipped package source. The
report resolves re-exports and records exported declarations; it is an interface
review aid, not an automatic semantic-version compatibility classifier.

The packed gate verifies explicit exports, external React peers, SSR/hydration,
tree shaking, archive contents, licensed notices, compiled CSS and size budgets.
JavaScript source maps must include complete source contents. Bundled
declarations are self-contained and currently omit declaration maps; any
advertised map must exist. Private workspace declaration maps are not a
published package feature.

## First alpha: explicit manual bootstrap

The registry returned 404 for `@startupmedia/pagebldr` during this checkpoint.
This does not prove that the name can be claimed by a particular account. Before
publishing, verify account authority, package identity, source ownership and the
exact reviewed candidate. Confirm the source commit and publish the same checked
archive, rather than rebuilding after approval.

The first publish is an interactive maintainer action with npm 2FA, after
explicit owner authorization. For the reviewed alpha candidate:

```sh
npm login
npm publish release-evidence/distribution/startupmedia-pagebldr-0.0.0-alpha.0.tgz --tag alpha --access public --provenance=false --ignore-scripts
```

The one-time local bootstrap has no CI provenance. Record that limitation, the
archive checksum and the registry response. Never enter credentials or OTPs in
committed files, command arguments or chat. Inspect the resulting package,
`alpha` dist-tag and installation before enabling subsequent automation. Do not
set or move `latest` for an alpha.

## Subsequent alphas: protected OIDC workflow

After the package exists, configure its npm trusted publisher for organization
`StartUpMediaUK`, repository `@startupmedia/pagebldr`, workflow
`publish-alpha.yml`, environment `npm-alpha`. Configure that GitHub environment
with required reviewer approval, restrict it to `release/alpha`, and set
repository variable `PAGEBLDR_NPM_PUBLISHING=enabled` only after that review.
These are external account changes and require explicit authorization. The
workflow also requires a public repository for provenance. Changing repository
visibility is a separate owner decision; this preparation does not change it.

Trusted publishing uses short-lived OIDC credentials. npm requires Node 22.14+
and npm 11.5.1+; the publish job uses Node 24 and `id-token: write`. Supported
hosted CI can supply provenance. Verify these requirements again when activating
the workflow. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[provenance](https://docs.npmjs.com/generating-provenance-statements/).

On the dedicated alpha branch, enter Changesets prerelease mode once:

```sh
pnpm changeset pre enter alpha
```

Review and commit that state when authorized. The release-PR workflow requires
the alpha state before versioning; it does not publish. Review the generated
version/changelog PR and its checks. Then explicitly dispatch
`Publish approved alpha` with the exact version. It reruns
package/browser/security gates, uploads the checked archive, waits for the
environment reviewer and verifies the archive again before publishing to
`alpha`. It cannot run from another branch or before the repository enable flag
is set. No long-lived npm write token is required.

Retain the version, source commit, checksum, browser reports and provenance URL.
Verify the installed registry artifact, including both public React majors and
published Runtime rendering. Deploy matching docs only after separate deployment
authorization. Retire obsolete publishing tokens after a successful OIDC
release. If a release fails, preserve evidence and investigate before retrying;
never overwrite an existing version or use a different archive under the same
approval.

## Release status and limits

The release record must distinguish local checks, GitHub-hosted checks, registry
publication and deployed docs. Existing authored-content accessibility findings,
physical-device testing limits and unperformed screen-reader review remain
explicit. Neither a dependency scan nor provenance proves the package is secure.
Host adoption begins after an approved alpha channel is actually consumable.
