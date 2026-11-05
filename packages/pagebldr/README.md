# pagebldr

An embeddable visual page-building engine for React applications. pagebldr owns
schema-versioned Documents, commands, Local history, a controlled editor,
production rendering, and optional lifecycle and published-page Runtime modules.
Your application remains responsible for routes, persistence choice,
authorization, Resources, and deployment.

> Pre-release: public alpha interfaces may change with documented migration
> guidance.

## Install

```sh
pnpm add pagebldr react react-dom
```

Import the package-owned stylesheet once in the Host application:

```ts
import "pagebldr/styles.css";
```

## Minimal controlled integration

```tsx
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type DocumentChangeEvent,
} from "pagebldr";
import { standardBlocks } from "pagebldr/library";
import { PagebldrEditor, PagebldrRenderer } from "pagebldr/react";

const builder = createPagebldr({
  namespace: "my-app",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  blocks: standardBlocks,
});

export function PageEditor({
  document,
  onChange,
}: {
  document: PageDocument;
  onChange: (event: DocumentChangeEvent) => void;
}) {
  return (
    <PagebldrEditor builder={builder} document={document} onChange={onChange} />
  );
}

export function PublishedPage({ document }: { document: PageDocument }) {
  return <PagebldrRenderer builder={builder} document={document} />;
}
```

The Host may supply `onSave` and `onPublish`, Resource adapters, custom
Elements, Blocks, Templates, Controls, Contributions, event sinks, or the
optional server and Runtime modules.

This setup includes the standard Elements, style controls and 23 Blocks. The
editor supplies the responsive shell, isolated canvas, Structure, inspector,
inline editing, drag placement, Local history, media picker and preview.
Templates, saved Blocks, media and durable lifecycle operations use Host
adapters. Consumers do not install Tailwind, shadcn or ReUI, or copy editor UI.
Extend the shell through Contributions and Presets; `children` does not replace
the editor. Use `PagebldrRenderer` for presentation and the Runtime module when
the Host needs published-route lookup, metadata and analytics.

## Public entry points

- `pagebldr` — configuration and shared contracts
- `pagebldr/library` — the standard Block catalogue
- `pagebldr/react` and `pagebldr/react/server` — editor and SSR-safe rendering
- `pagebldr/server` and `pagebldr/server/next` — optional lifecycle
  orchestration
- `pagebldr/runtime` and `pagebldr/runtime/next` — published route resolution
- `pagebldr/adapters/memory` and `pagebldr/adapters/prisma` — Storage adapters
- `pagebldr/styles.css` — compiled editor styles and theme variables

See the [repository](https://github.com/StartUpMediaUK/pagebldr) for complete
documentation, examples, support, security, and contribution guidance.
