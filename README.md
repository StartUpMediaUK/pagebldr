# pagebldr

`pagebldr` is a planned embeddable visual page-building engine for React
applications. It owns a schema-versioned document model, editing engine, visual
editor, and production renderer while the host application owns storage,
publication, assets, links, permissions, and surrounding product UX.

Licensed under the [MIT License](LICENSE).

This repository is in its specification and extraction-planning stage. No
package has been published and no public interface is stable yet.

The editor UI is built from package-owned shadcn primitives and ReUI
compositions. Consumers receive compiled styles and do not need to install
either UI system. Quizr, Tener, and other applications integrate through the
same public package interface without product-specific compatibility layers.

## Current documents

- [Product specification](docs/product-specification.md)
- [Public interface proposal](docs/public-interface.md)
- [Editor composition proposal](docs/editor-composition.md)
- [Package architecture and extraction plan](docs/architecture-and-extraction.md)
- [Open owner decisions](docs/owner-decisions.md)
- [Startup Media repository audit](docs/startup-media-audit.md)
- [Package and release research](docs/research/package-and-release-foundations.md)
- [Standalone package plan](docs/plans/standalone-package/plan.md)
- [Source and licence inventory](docs/plans/standalone-package/source-and-license-inventory.md)

## Source

The implementation source is Quizr Page Builder V2 on Quizr's
`feature/product-development` branch. Extraction must preserve compatible
documents while removing Quizr product policy and Next.js coupling. The legacy
Quizr page builder is explicitly out of scope.
