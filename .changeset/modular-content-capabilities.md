---
"@startupmedia/pagebldr": minor
---

Add editable content tabs and rich accordions with ordinary owned panel subtrees
and a typed Host React renderer registration shared across editor, SSR and
publication. Extend gallery sizing, responsive grid/masonry controls,
destinations and modal image viewing; support bounded nested disclosure
navigation and hierarchy controls. Scope FAQ disclosure groups independently.
Preserve opaque Resources during copying, allocate fresh copied anchors and
resolve library dependency name collisions without overwriting destination
design values. Existing text tabs, FAQs, flat menus and Gallery v1/v2 Documents
remain supported.

Make the default Tabs insertion create editable panel trees. Add centered panel
canvas sessions occupying 80% of the viewport with page-owned content with
atomic save, cancel and reopening; preserve Host renderers and page references.
Existing text Tabs can be explicitly converted without losing content. Add the
guarded apply-subtree command and subtree rendering.

Scale panel-canvas editor UI breakpoints down by 20% to match the dialog size,
while preserving the main editor layout and authored page breakpoints.

Place panel Save changes and Cancel actions in the canvas toolbar without a
duplicate title row.

Allow panel dialogs to resize from 80% to 100% of the viewport using independent
edge handles or keyboard controls, without changing the authored Document or
history.

Expose tab header appearance controls, use labelled icon actions for panels, and
replace per-tab default switches with one undoable Default tab selector.

Compact the Tabs Content inspector into inline rename/edit rows with action
menus. Group header styling in Style with visual presets, state-specific colours
and expandable typography, spacing and behaviour sections.

Integrate tab header settings into the standard styling sections and shared
Reset actions, without a separate Element styles panel or duplicate state and
typography controls.

Add icon controls for tab header alignment and distribution under Style →
Layout.

Select editable panels from canvas tab headers, preserve Host tab theme tokens,
and scope style resets. Restore legacy gallery controls, name decorative image
links, and dismiss nested navigation after destination selection.

Group the Elements panel by purpose, with a Custom Elements group for Host
registrations and panel children managed through their parent controls.
