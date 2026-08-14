import { createElement, type ComponentType, type ReactNode } from "react";

import type { EditorContextValue } from "./context.js";

export const editorSlots = [
  "toolbar.leading",
  "toolbar.trailing",
  "sidebar.start",
  "sidebar.end",
  "canvas.overlay",
  "status",
] as const;

export type EditorSlot = (typeof editorSlots)[number];
export type EditorContributionKind =
  "toolbarAction" | "panel" | "panelTab" | "canvasOverlay" | "statusItem";
export type EditorCapability = "edit" | "save" | "publish" | "resources";

export interface EditorContributionContext extends EditorContextValue {
  readonly capabilities: ReadonlySet<EditorCapability>;
}

export interface EditorContribution<
  Kind extends EditorContributionKind = EditorContributionKind,
> {
  readonly id: string;
  readonly kind: Kind;
  readonly label: string;
  readonly requires?: readonly EditorCapability[];
  readonly render: ComponentType<{
    readonly context: EditorContributionContext;
  }>;
}

export interface EditorPlacement {
  readonly slot: EditorSlot;
  readonly contributionIds: readonly string[];
}

export interface EditorPreset {
  readonly id: string;
  readonly label: string;
  readonly placements: readonly EditorPlacement[];
}

export interface EditorComposition {
  readonly preset: EditorPreset;
  readonly contributions: ReadonlyMap<string, EditorContribution>;
  readonly render: (
    slot: EditorSlot,
    context: EditorContributionContext,
  ) => ReactNode;
}

const allowedKinds: Readonly<
  Record<EditorSlot, readonly EditorContributionKind[]>
> = {
  "toolbar.leading": ["toolbarAction"],
  "toolbar.trailing": ["toolbarAction"],
  "sidebar.start": ["panel", "panelTab"],
  "sidebar.end": ["panel", "panelTab"],
  "canvas.overlay": ["canvasOverlay"],
  status: ["statusItem"],
};

export function defineEditorContribution<Kind extends EditorContributionKind>(
  contribution: EditorContribution<Kind>,
): EditorContribution<Kind> {
  assertKey("Contribution", contribution.id);
  return Object.freeze(contribution);
}

export function defineEditorPreset(preset: EditorPreset): EditorPreset {
  assertKey("Preset", preset.id);
  const seenSlots = new Set<EditorSlot>();
  const seenContributions = new Set<string>();
  for (const placement of preset.placements) {
    if (!editorSlots.includes(placement.slot))
      throw new Error(`Unknown editor Slot: ${String(placement.slot)}.`);
    if (seenSlots.has(placement.slot))
      throw new Error(
        `Editor Slot ${placement.slot} is placed more than once.`,
      );
    seenSlots.add(placement.slot);
    for (const id of placement.contributionIds) {
      assertKey("Contribution", id);
      if (seenContributions.has(id))
        throw new Error(`Editor Contribution ${id} is placed more than once.`);
      seenContributions.add(id);
    }
  }
  return Object.freeze(preset);
}

export function createEditorComposition(
  preset: EditorPreset,
  contributions: readonly EditorContribution[],
): EditorComposition {
  const byId = new Map<string, EditorContribution>();
  for (const contribution of contributions) {
    if (byId.has(contribution.id))
      throw new Error(
        `Editor Contribution ${contribution.id} is registered more than once.`,
      );
    byId.set(contribution.id, contribution);
  }
  for (const placement of preset.placements) {
    for (const id of placement.contributionIds) {
      const contribution = byId.get(id);
      if (!contribution)
        throw new Error(
          `Editor Preset ${preset.id} references unknown Contribution ${id}.`,
        );
      if (!allowedKinds[placement.slot].includes(contribution.kind))
        throw new Error(
          `Editor Contribution ${id} (${contribution.kind}) cannot be placed in Slot ${placement.slot}.`,
        );
    }
  }
  return Object.freeze({
    preset,
    contributions: byId,
    render: (slot: EditorSlot, context: EditorContributionContext) =>
      preset.placements
        .find((placement) => placement.slot === slot)
        ?.contributionIds.flatMap((id) => {
          const contribution = byId.get(id)!;
          if (
            contribution.requires?.some(
              (capability) => !context.capabilities.has(capability),
            )
          )
            return [];
          return [createElement(contribution.render, { key: id, context })];
        }) ?? null,
  });
}

function assertKey(kind: string, value: string): void {
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(value))
    throw new Error(`${kind} id must use lowercase dot or kebab notation.`);
}
