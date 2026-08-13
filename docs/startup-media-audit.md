# Startup Media repository audit

Date: 2026-08-12. Scope: read-only audit of `D:\Documents\dev\startup-media`; no changes were made.

## Current state

The checkout tracks `origin/master` and contains no root README, root ignore rules, workspace manifest, root package manifest, contribution guidance, or CI configuration. The tracked tree is two independent Next.js 14 applications under `platform/store` and `platform/templates/zenith`, each with its own npm lockfile. An untracked `platform/marketing` Next.js 16 application uses pnpm and appears to be active user work.

The worktree is not clean:

- `platform/store/.sanity/runtime/app.js` and `index.html` are deleted locally;
- `platform/marketing/` is untracked.

Those changes belong to the user and must be preserved. A modernization branch must not begin by resetting or absorbing them without an explicit scope decision.

## Findings

### Critical: tracked environment file

`platform/store/.env` is tracked in `master`. Its contents were deliberately not inspected. Removing the file from the current tree does not remove secrets from Git history; the owner should determine whether it ever contained live credentials, rotate any possibly exposed credentials, add a safe `.env.example`, and decide whether history rewriting is warranted.

### High: generated artifacts are tracked

`platform/store/dist/` contains 21 tracked Sanity build artifacts and `.sanity/runtime/` contains two tracked generated files. The current local deletions indicate at least some generated runtime output is already being cleaned manually. Root and app ignore policy should exclude build outputs consistently, after confirming no deployment depends on committed output.

### High: no repository-level operating model

There is no root workspace, unified package manager, shared scripts, CI, ownership map, or documentation explaining whether `store`, `zenith`, and the new `marketing` application are maintained products, examples, templates, or archives. Modernization cannot safely infer lifecycle from folder names.

### Medium: obsolete application toolchains

`store` and `zenith` use Next.js 14.2.4, React 18, ESLint 8, Tailwind 3, and `next lint`; `marketing` uses Next.js 16.1.6, React 19, ESLint 9, Tailwind 4, and pnpm. Toolchain unification is desirable, but upgrading the older applications is application migration work and should follow runnable baseline tests rather than a bulk manifest rewrite.

### Medium: mixed dependency and lockfile policy

The older applications use npm lockfiles while `marketing` has a pnpm lockfile/workspace file inside the app. Introducing a root pnpm workspace would require choosing whether app lockfiles are intentionally retained during transition or replaced in a single reviewed migration.

## Proposed repair plan (requires approval)

1. Secure: inspect the tracked `.env` through an owner-controlled secret review, rotate credentials if needed, replace it with `.env.example`, and decide on history remediation.
2. Classify: label each application `active`, `template`, or `archive`; decide whether untracked `marketing` is intended for this repository.
3. Establish the root: README, licence/visibility statement, security policy, contribution guidance, root ignore rules, ownership, and a pnpm workspace with non-destructive per-app scripts.
4. Clean generated output: confirm deployment assumptions, remove tracked `dist`/`.sanity` artifacts, and add ignore rules in the same reviewed change.
5. Baseline each retained app on its current toolchain, documenting missing environment dependencies and adding CI that runs only honest, passing checks.
6. Modernize retained applications one at a time, starting with framework-supported codemods and runtime verification. Do not combine application upgrades with the workspace conversion.

## Decisions needed

- Is `platform/marketing` intended to replace a company site and should its existing uncommitted state be committed before repository repair?
- Are `store` and `zenith` active, reference-only, or candidates for archival/removal?
- Does any deployment consume the committed Sanity `dist` directory?
- Who will conduct secret rotation/history review for the tracked `.env`?
- Should the company repository use the same licence and governance as `pagebldr`, or remain private/internal?

`pagebldr` should remain a separate canonical repository regardless of these answers.
