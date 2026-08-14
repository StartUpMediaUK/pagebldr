# Editor composition

Hosts can rearrange editor regions and add product actions without importing
internal React modules or accessing the editor store.

## Public model

- A Slot is a stable logical placement location with an allowed Contribution
  kind.
- A Contribution is a keyed panel, panel tab, toolbar action, canvas overlay, or
  status item.
- A Preset assigns ordered Contribution IDs to Slots.

The alpha Slots are `toolbar.leading`, `toolbar.trailing`, `sidebar.start`,
`sidebar.end`, `canvas.overlay`, and `status`. Logical start/end names preserve
directional and responsive layout options.

```tsx
import {
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
} from "pagebldr/react";

const action = defineEditorContribution({
  id: "my-app.select-page",
  kind: "toolbarAction",
  label: "Select page",
  requires: ["edit"],
  render: ({ context }) => (
    <button onClick={() => context.select(context.document.rootId)}>
      Select page
    </button>
  ),
});

const preset = defineEditorPreset({
  id: "my-app-standard",
  label: "My app standard",
  placements: standardEditorPreset.placements.map((placement) => ({
    ...placement,
    contributionIds:
      placement.slot === "toolbar.trailing"
        ? [...placement.contributionIds, action.id]
        : placement.contributionIds,
  })),
});

<PagebldrEditor
  contributions={[action]}
  preset={preset}
  // controlled Document and callbacks
/>;
```

## Validation and capabilities

`createEditorComposition()` rejects duplicate IDs, unknown Contribution
references, duplicate placement, and incompatible Slot/kind combinations.
Contributions may require `edit`, `save`, `publish`, or `resources`; unavailable
Contributions are omitted before rendering. These are package capabilities, not
Host roles or permissions.

The Contribution context exposes the public controlled Document, Builder,
selection, viewport, command dispatch, undo/redo, and capability set. It does
not expose the internal store, DOM structure, shadcn source, or CSS utility
classes.

## Built-in presets

`standardEditorPreset` places navigation at logical start and the inspector at
logical end. `focusEditorPreset` swaps those surfaces while retaining the same
built-in functionality and public composition path.

The Vite example demonstrates all five Contribution kinds. Hosts own their
Contribution presentation and should use accessible controls appropriate to
their application design system.
