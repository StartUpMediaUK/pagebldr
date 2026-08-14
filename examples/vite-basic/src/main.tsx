import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "pagebldr";
import { PagebldrEditor } from "pagebldr/react";
import {
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
} from "pagebldr/react";
import "pagebldr/styles.css";

const builder = createPagebldr({
  namespace: "vite-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
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

  return (
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
