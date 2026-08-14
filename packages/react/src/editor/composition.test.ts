import { createElement } from "react";
import { describe, expect, it } from "vitest";

import type { EditorContributionContext } from "./composition.js";
import {
  createEditorComposition,
  defineEditorContribution,
  defineEditorPreset,
} from "./composition.js";
import { focusEditorPreset, standardEditorPreset } from "./presets.js";

const panel = defineEditorContribution({
  id: "example.panel",
  kind: "panel",
  label: "Example panel",
  render: () => createElement("div", null, "Panel"),
});
const action = defineEditorContribution({
  id: "example.action",
  kind: "toolbarAction",
  label: "Example action",
  requires: ["publish"],
  render: () => createElement("button", null, "Action"),
});

describe("editor composition", () => {
  it("rejects invalid Slot and Contribution combinations", () => {
    const preset = defineEditorPreset({
      id: "invalid",
      label: "Invalid",
      placements: [{ slot: "toolbar.leading", contributionIds: [panel.id] }],
    });
    expect(() => createEditorComposition(preset, [panel])).toThrow(
      /cannot be placed in Slot toolbar.leading/u,
    );
  });

  it("rejects unknown and duplicate Contributions", () => {
    const preset = defineEditorPreset({
      id: "unknown",
      label: "Unknown",
      placements: [
        { slot: "sidebar.start", contributionIds: ["missing.panel"] },
      ],
    });
    expect(() => createEditorComposition(preset, [])).toThrow(
      /unknown Contribution missing.panel/u,
    );
    expect(() => createEditorComposition(preset, [panel, panel])).toThrow(
      /registered more than once/u,
    );
  });

  it("filters unavailable capabilities", () => {
    const preset = defineEditorPreset({
      id: "capabilities",
      label: "Capabilities",
      placements: [{ slot: "toolbar.trailing", contributionIds: [action.id] }],
    });
    const composition = createEditorComposition(preset, [action]);
    const context = {
      capabilities: new Set(),
    } as unknown as EditorContributionContext;
    expect(composition.render("toolbar.trailing", context)).toEqual([]);
    const enabled = {
      capabilities: new Set(["publish"]),
    } as unknown as EditorContributionContext;
    expect(composition.render("toolbar.trailing", enabled)).toHaveLength(1);
  });

  it("ships materially different standard and focus arrangements", () => {
    expect(standardEditorPreset.placements).not.toEqual(
      focusEditorPreset.placements,
    );
    expect(
      standardEditorPreset.placements.find(
        ({ slot }) => slot === "sidebar.start",
      )?.contributionIds,
    ).toEqual(["pagebldr.navigator"]);
    expect(
      focusEditorPreset.placements.find(({ slot }) => slot === "sidebar.start")
        ?.contributionIds,
    ).toEqual(["pagebldr.inspector"]);
  });
});
