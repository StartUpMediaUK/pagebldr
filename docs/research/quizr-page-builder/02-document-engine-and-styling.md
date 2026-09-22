# Document engine and styling

## The stored document

Quizr stores a versioned JSON document, not HTML, JSX or serialized editor
markup.

```text
Document
├── format: "quizr-page-v2"
├── schemaVersion: 1
├── id, title, slug, rootId
├── elements: Record<ElementId, Element>
├── classes: Record<ClassId, StyleClass>
├── classOrder: ClassId[]
├── variables: Record<VariableId, Variable>
├── variableOrder: VariableId[]
└── settings
    ├── contentWidth
    ├── showDefaultHeader
    ├── breakpoints: tabletMax, mobileMax
    └── seo
```

Each element contains `id`, `type`, `elementVersion`, authored `name`,
open-ended but definition-validated `props`, child IDs, assigned class IDs,
responsive local styles, `locked` and `hidden`.

The normalized map and child-ID representation are fundamental. A subtree is
never embedded recursively in its parent. This gives commands stable targets,
makes patches compact, and lets validation prove global tree properties.

## Schema limits

- IDs are 1–128 characters, begin with a letter, and contain only letters,
  numbers, underscores and hyphens.
- Anchor IDs are optional, unique, lowercase hyphenated slugs up to 80
  characters.
- Element names are 1–120 characters; page titles 1–160; slugs 1–120.
- An element may list up to 5,000 children and 32 classes.
- Content width is 320–2,400px.
- Tablet maximum is 768–1,200px; mobile maximum is 320–767px and must remain
  below the tablet maximum.
- SEO limits are 70 title, 170 search description, 70 social title and 200
  social description characters.

## Validation invariants

Every accepted document must satisfy both schema validation and registry-aware
semantic validation:

- the root exists and is a `container`;
- map keys equal the contained IDs;
- all child references exist;
- every non-root element has exactly one parent;
- the graph is connected, acyclic and contains no orphan elements;
- child policy and maximum-child rules from the parent definition are satisfied;
- each element type exists in the registry and its props match that definition;
- element versions are not newer than the registered definition;
- class and variable order arrays contain every corresponding map entry exactly
  once;
- assigned classes and referenced variables exist;
- style properties are valid and supported by the target element's declared
  capabilities;
- typed quiz, anchor, external, email and telephone destinations are valid;
- anchor destinations point to existing elements and authored anchor IDs remain
  unique; and
- document settings and SEO conform to their bounds.

Validation runs before and after command application, on server inputs, before
publication, when loading managed templates and after migrations.

## Command-only mutation

The engine changes documents through commands. `commitPageBuilderV2Command`
validates the input document, computes forward and inverse patches, applies the
change, validates the result and records an action label.

Supported command families are:

- insert, move, duplicate and remove an element subtree;
- rename, lock/unlock and hide/show an element;
- update element props;
- set one local/class style property or replace a complete responsive style
  object;
- add, add-and-assign, rename, delete, assign, unassign and reorder classes;
- add, rename, update, delete and reorder variables;
- apply a complete template;
- update page identity fields; and
- update page settings.

Commands enforce product rules, not just data shape. The root cannot be removed,
moved or duplicated. A locked element rejects protected mutations. A move cannot
create a cycle or violate child policy. Deleting a used variable or incompatible
class is rejected or handled by the command's explicit policy rather than
leaving broken references.

## Local history

Local Actions use patch-based history:

- maximum 100 recorded actions;
- past, present and future partitions;
- inverse patches for undo and forward patches for redo;
- jump to any action position from the History sheet; and
- coalescing within 750ms when editor controls supply the same coalescing key.

Undo, redo and history jumps make the editor dirty because they change the local
draft. Selecting, hovering, opening panels, changing preview mode, changing zoom
and changing authored breakpoint are editor state and do not enter document
history.

## Clipboard and reusable subtrees

Copy serializes the selected subtree plus only its referenced classes and
variables into `quizr-page-v2-clipboard` schema version 1. Paste:

- accepts the internal store or valid JSON from the system clipboard;
- creates fresh element IDs;
- remaps internal element destinations;
- adapts class and variable IDs to the target document;
- keeps child order and ordinary props/styles; and
- validates the final insertion.

Copy style and Paste style are separate from element copy. Saved blocks persist
the same clipboard shape, so a saved block and a copied subtree share semantics.

## Responsive style model

Styles are stored as:

```text
responsiveStyles[desktop|tablet|mobile]
  [normal|hover|focusVisible]
    [property] = literal | number | variable reference
```

The inheritance chain is Desktop → Tablet → Mobile. Tablet inherits unresolved
Desktop declarations; Mobile inherits unresolved Tablet and Desktop
declarations. State falls back to normal where appropriate. The editor displays
the source of an inherited value and allows a local declaration to be reset back
to inheritance.

At a given breakpoint/state, assigned classes are applied in `classIds` order,
then local element declarations win. Later declarations therefore override
earlier class declarations. Class ordering in the document governs global
definition order; assignment order governs an element's class cascade.

### Capabilities

Element definitions opt into coherent groups rather than receiving every CSS
property automatically:

| Capability            | Properties represented by the engine/editor                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Layout                | display, flex sizing/direction/wrap/alignment, gap, grid placement/templates and order                            |
| Spacing               | margin and padding shorthands/sides                                                                               |
| Size                  | width/min/max, height/min/max, aspect ratio, object fit and overflow                                              |
| Position              | position, four offsets and z-index                                                                                |
| Typography            | colour, family, size/style/weight, spacing/height, alignment, decoration, transform, whitespace and word breaking |
| Background            | background shorthand, colour, image, position, repeat and size                                                    |
| Border                | shorthands/sides, colour, radius, style, width, outline and offset                                                |
| Effects               | backdrop filter, shadow, cursor, filter, opacity, transform/origin and transition                                 |
| Responsive visibility | display and visibility                                                                                            |

The allowed-property list has 91 unique entries. The nine capability groups
contain 92 assignments because `display` belongs to both Layout and Responsive
visibility. A definition cannot register an unknown property, and a command
cannot write a property outside the selected element's capabilities.

### Editor surface split

Style shows Typography and Background. Advanced shows Layout, Size, Spacing,
Border, Effects, Position and Responsive visibility. This is a presentation
split over one style system; it does not create separate data models.

### Fonts

The approved font choices are System sans, System serif, Geist, Inter, Roboto,
Open Sans, Montserrat, Poppins, Merriweather and Playfair Display. The runtime
uses known CSS variables/fallback stacks rather than accepting arbitrary font
imports.

## Variables

Variables have an ID, editable name, kind and scalar value. Kinds constrain
where a reference may be used:

- Colour: text, background and border colours.
- Typography: font family.
- Spacing: gaps, margins, padding and positional offsets.
- Radius: border radius.
- Shadow: box shadow.
- Content width: width, minimum width and maximum width.

The compiler emits variables as document-scoped CSS custom properties. The Page
design dialog shows how many declarations use each variable and protects
consistency through command validation.

## Classes: engine capability versus exposed feature

The engine fully models style classes. Commands, validation, clipboard
adaptation, CSS compilation and a class-manager component support creation,
duplication, assignment, ordering, shared editing and guarded deletion.

The current staging editor does **not** expose class controls. The pinned editor
source sets `SHOW_PAGE_BUILDER_V2_CLASS_CONTROLS = false`. Existing templates
can still contain classes, their values participate in the cascade, and
inspector fields report inherited origins such as `Class: Editorial heading`.
This must be described as dormant authoring capability, not as an available
staging workflow.

## CSS compilation

The compiler generates document-scoped CSS with:

- page variable custom properties;
- ordered class rules;
- local element rules after class rules;
- desktop declarations as the base;
- tablet and mobile max-width media queries from document settings;
- `:hover` and `:focus-visible` state rules;
- forced editor-state attributes so authors can inspect non-normal states; and
- per-element selectors stable across editor and runtime.

Unsafe style syntax is rejected or sanitized. The compiler blocks
declaration-breaking characters, comments, `javascript:`, `expression`,
`@import` and unsafe background URLs. Runtime asset URLs are resolved through
trusted media callbacks rather than injected raw from arbitrary markup.

`hidden` is a document flag, not the same as responsive `display: none`. Public
rendering omits hidden elements completely. Editor rendering keeps them
discoverable so they can be selected and shown again.

## Migrations

Document schema and element schema versions are independent.

- Document migrations must advance exactly one version at a time and are
  registered by `fromVersion`.
- A future document version is rejected.
- Missing sequential migrations are rejected.
- After document migration, every element is migrated from its stored
  `elementVersion` to the current definition version.
- Image v1→v2 adds explicit accessibility confirmation state.
- Video v1→v2 converts legacy URL shape to typed asset/external sources.
- Progress v1→v2 adds track/indicator styling, thickness and radius defaults.
- Gallery/Carousel v1→v2 converts legacy gallery/carousel image collections into
  typed ordered image/video items and a deterministic layout.

Every migrated result is cloned, validated and returned as the normal current
document. The public runtime also migrates before rendering, so older valid
persisted documents do not require ad hoc branches in each renderer.
