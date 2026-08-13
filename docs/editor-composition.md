# Editor composition proposal

## Goal

Allow Hosts to rearrange editor regions and add product actions without exposing internal React modules or accepting an arbitrary override object.

## Model

The shell uses three typed concepts:

- a Slot is a stable placement location with an allowed contribution kind;
- a Contribution is a keyed panel, tab, action, or canvas adjunct;
- a Preset arranges Slots and selects/orders Contributions.

The built-in stable slots proposed for alpha are `topbar.leading`, `topbar.center`, `topbar.trailing`, `sidebar.start`, `canvas`, `sidebar.end`, and `overlay`. Panels own nested tab slots. Physical words such as left/right are avoided so direction and responsive layouts remain possible.

```ts
const compactPreset = defineEditorPreset({
  id: "compact",
  regions: [
    region("top", { slots: ["topbar.leading", "topbar.trailing"] }),
    region("workspace", {
      slots: ["sidebar.start", "canvas", "sidebar.end"],
    }),
  ],
  placements: {
    "sidebar.start": ["library", "structure"],
    "sidebar.end": ["inspector"],
  },
});
```

Exact helper syntax should be proven through TypeScript tests; string unions above illustrate the model, not final names.

## Stable contribution kinds

- `panel`: dockable/collapsible content with title, icon, minimum size, and allowed slots;
- `panelTab`: content placed inside a compatible panel's tab slot;
- `toolbarAction`: an action with availability, shortcut, label, and invocation contract;
- `canvasOverlay`: selection or guide UI anchored to the canvas coordinate system;
- `statusItem`: compact status/progress content.

Contributions receive a restricted editor context containing selectors and command dispatch, not the internal store. This preserves the command-only mutation invariant and allows the store implementation to change.

## Placement and visibility

Each placement may specify order, initial state (`open`, `collapsed`, `hidden`), presentation (`docked`, and later `floating` where supported), and responsive fallback. Unsupported combinations fail configuration validation rather than degrading silently.

Host permissions map to named capabilities (`document.edit`, `document.save`, `document.publish`, `resource.asset.upload`, and so on). Contributions declare required capabilities; they do not receive or interpret the Host's roles.

## Presets

Alpha ships one polished `standard` preset. Beta must prove the seam with at least one materially different `compact` or `focus` preset assembled only through public interfaces. Hosts can extend a preset by keyed operations (`add`, `remove`, `place`, `order`) rather than copying the full built-in object, which keeps defaults evolvable.

## Explicit non-interface

Internal DOM structure, CSS class names other than documented theme hooks, internal store shape, component imports, drag sensor implementation, and dialog primitives are not extension seams. Custom Contributions are isolated by public context and package styles.
