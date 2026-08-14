import { defineEditorPreset } from "./composition.js";

export const standardEditorPreset = defineEditorPreset({
  id: "standard",
  label: "Standard",
  placements: [
    { slot: "toolbar.leading", contributionIds: ["pagebldr.history"] },
    { slot: "toolbar.trailing", contributionIds: ["pagebldr.persistence"] },
    { slot: "sidebar.start", contributionIds: ["pagebldr.navigator"] },
    { slot: "sidebar.end", contributionIds: ["pagebldr.inspector"] },
    { slot: "canvas.overlay", contributionIds: [] },
    {
      slot: "status",
      contributionIds: ["pagebldr.selection", "pagebldr.status"],
    },
  ],
});

export const focusEditorPreset = defineEditorPreset({
  id: "focus",
  label: "Focus",
  placements: [
    { slot: "toolbar.leading", contributionIds: ["pagebldr.history"] },
    { slot: "toolbar.trailing", contributionIds: ["pagebldr.persistence"] },
    { slot: "sidebar.start", contributionIds: ["pagebldr.inspector"] },
    { slot: "sidebar.end", contributionIds: ["pagebldr.navigator"] },
    { slot: "canvas.overlay", contributionIds: [] },
    {
      slot: "status",
      contributionIds: ["pagebldr.selection", "pagebldr.status"],
    },
  ],
});
