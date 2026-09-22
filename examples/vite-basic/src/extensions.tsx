import type { PagebldrEditorProps } from "pagebldr/react";
import {
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
} from "pagebldr/react";

const contributions = [
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

const preset = defineEditorPreset({
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

export const extensionEditorOptions = {
  contributions,
  preset,
} satisfies Pick<PagebldrEditorProps, "contributions" | "preset">;
