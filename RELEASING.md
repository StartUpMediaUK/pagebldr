# Releasing pagebldr

Only `packages/pagebldr` is published. Documentation and examples are private
workspace consumers. Releases and documentation deployments require explicit
maintainer authorization.

Before a release, run `pnpm check` and verify the packed artifact in isolated
Vite and Next.js consumers under each supported React major. Review public
exports, declarations, compiled CSS, SSR, migrations, licence notices and
browser accessibility. Record the source commit, version and verification
results.

Use Changesets for package changes and review migration guidance for
compatibility changes. Prereleases use the `alpha` dist-tag; publish only the
exact reviewed artifact. Keep credentials and generated evidence out of Git.
Store selected reports as CI artifacts or attach them to the reviewed release
record.

After publication, verify installation from the registry and deploy matching
documentation only when authorized.
