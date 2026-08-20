import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type StandardSchemaV1,
} from "pagebldr";
import { PagebldrEditor, PagebldrRenderer } from "pagebldr/react";
import {
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
} from "pagebldr/react";
import "pagebldr/styles.css";

const stringReference: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "vite-example",
    validate: (value) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Resource reference must be a string." }] },
  },
};

const builder = createPagebldr({
  namespace: "vite-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  resources: {
    asset: {
      reference: stringReference,
      resolve: (id) => (typeof id === "string" ? `/assets/${id}` : null),
      browse: ({ query }) =>
        Promise.resolve({
          items: ["hero.jpg", "product.jpg"].filter((id) =>
            id.includes(query ?? ""),
          ),
        }),
    },
    "application-link": {
      reference: stringReference,
      resolve: (slug) =>
        typeof slug === "string" ? `#/preview/${slug}` : null,
      browse: () => Promise.resolve({ items: ["welcome", "pricing"] }),
    },
  },
});

const initialDocument = builder.documents.create({
  id: "welcome",
  title: "My first page",
  slug: "welcome",
});

const exampleContributions = [
  defineEditorContribution({
    id: "example.preview-action",
    kind: "toolbarAction",
    label: "Preview action",
    render: ({ context }) => (
      <button
        type="button"
        onClick={() => context.select(context.document.rootId)}
      >
        Select page
      </button>
    ),
  }),
  defineEditorContribution({
    id: "example.notes-panel",
    kind: "panel",
    label: "Notes panel",
    render: () => (
      <aside aria-label="Example notes">Host-owned notes panel</aside>
    ),
  }),
  defineEditorContribution({
    id: "example.info-tab",
    kind: "panelTab",
    label: "Information tab",
    render: ({ context }) => <p>{context.document.id}</p>,
  }),
  defineEditorContribution({
    id: "example.canvas-label",
    kind: "canvasOverlay",
    label: "Canvas label",
    render: () => <span>Draft canvas</span>,
  }),
  defineEditorContribution({
    id: "example.element-count",
    kind: "statusItem",
    label: "Element count",
    render: ({ context }) => (
      <span>{Object.keys(context.document.elements).length} Elements</span>
    ),
  }),
] as const;

const examplePreset = defineEditorPreset({
  id: "example",
  label: "Example",
  placements: standardEditorPreset.placements.map((placement) => ({
    ...placement,
    contributionIds:
      placement.slot === "toolbar.trailing"
        ? [...placement.contributionIds, "example.preview-action"]
        : placement.slot === "sidebar.start"
          ? [
              ...placement.contributionIds,
              "example.notes-panel",
              "example.info-tab",
            ]
          : placement.slot === "canvas.overlay"
            ? ["example.canvas-label"]
            : placement.slot === "status"
              ? [...placement.contributionIds, "example.element-count"]
              : placement.contributionIds,
  })),
});

function App() {
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [route, setRoute] = useState(window.location.hash || "#/edit");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/edit");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.startsWith("#/preview"))
    return (
      <main>
        <nav>
          <a href="#/edit">Back to editor</a>
        </nav>
        <PagebldrRenderer
          builder={builder}
          document={document}
          mode="published"
        />
      </main>
    );

  return (
    <main>
      <nav>
        <a href="#/preview/welcome">Open production preview</a>
      </nav>
      <PagebldrEditor
        builder={builder}
        contributions={exampleContributions}
        document={document}
        onChange={({ document: nextDocument }) => setDocument(nextDocument)}
        onSave={async ({ document: nextDocument }) => {
          await pause();
          localStorage.setItem(
            "pagebldr-vite-example",
            JSON.stringify(nextDocument),
          );
        }}
        onPublish={async () => pause()}
        preset={examplePreset}
      />
    </main>
  );
}

function pause() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 350));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
