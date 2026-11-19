# @startupmedia/pagebldr

## 0.0.0-alpha.2

### Minor Changes

- 6f0e5e9: Add editable content tabs and rich accordions with ordinary owned
  panel subtrees and a typed Host React renderer registration shared across
  editor, SSR and publication. Extend gallery sizing, responsive grid/masonry
  controls, destinations and modal image viewing; support bounded nested
  disclosure navigation and hierarchy controls. Scope FAQ disclosure groups
  independently. Preserve opaque Resources during copying, allocate fresh copied
  anchors and resolve library dependency name collisions without overwriting
  destination design values. Existing text tabs, FAQs, flat menus and Gallery
  v1/v2 Documents remain supported.

  Make the default Tabs insertion create editable panel trees. Add centered
  panel canvas sessions occupying 80% of the viewport with page-owned content
  with atomic save, cancel and reopening; preserve Host renderers and page
  references. Existing text Tabs can be explicitly converted without losing
  content. Add the guarded apply-subtree command and subtree rendering.

  Scale panel-canvas editor UI breakpoints down by 20% to match the dialog size,
  while preserving the main editor layout and authored page breakpoints.

  Place panel Save changes and Cancel actions in the canvas toolbar without a
  duplicate title row.

  Allow panel dialogs to resize from 80% to 100% of the viewport using
  independent edge handles or keyboard controls, without changing the authored
  Document or history.

  Expose tab header appearance controls, use labelled icon actions for panels,
  and replace per-tab default switches with one undoable Default tab selector.

  Compact the Tabs Content inspector into inline rename/edit rows with action
  menus. Group header styling in Style with visual presets, state-specific
  colours and expandable typography, spacing and behaviour sections.

  Integrate tab header settings into the standard styling sections and shared
  Reset actions, without a separate Element styles panel or duplicate state and
  typography controls.

  Add icon controls for tab header alignment and distribution under Style →
  Layout.

  Select editable panels from canvas tab headers, preserve Host tab theme
  tokens, and scope style resets. Restore legacy gallery controls, name
  decorative image links, and dismiss nested navigation after destination
  selection.

  Group the Elements panel by purpose, with a Custom Elements group for Host
  registrations and panel children managed through their parent controls.

## 0.0.0-alpha.1

### Minor Changes

- 3bba3d0: Complete the schema-v2 Document, command, Local history, Destination
  and style engine contracts derived from the Quizr page builder. Replace the
  placeholder standard library with 24 strict, versioned Element definitions,
  package-owned rendering and interactive widgets, media migrations, typed
  Destination resolution, approved fonts, and the full Project Enquiry Reference
  Host. Add the isolated authored canvas, versioned shell bridge, responsive
  authored viewports, zoom/Fit/reveal controls, command-backed inline editing,
  validated drag/drop placement, keyboard movement and local-Document preview.
- 557f55e: Always mount the controlled editor shell. Remove the provisional
  `PagebldrEditor.children` replacement prop, which bypassed editor context and
  behavior. Move custom editor surfaces into Contributions placed by a Preset.
  The packed consumer now verifies this public extension path and rejects the
  old replacement prop. Correct the minimal setup to register the standard
  Elements, style capabilities and Blocks explicitly.
- fd7d118: Add command-oriented library preparation for independently inserted
  Blocks and cloned Templates. Block preparation preserves customized
  destination design dependencies; Template cloning validates the Document and
  remaps internal Element references with fresh IDs.
- cee9ab2: Add the standard 23-Block catalogue at
  `@startupmedia/pagebldr/library`, a searchable editor library, Host-backed
  saved Blocks and managed Templates, and optional Resource media
  browse/lookup/upload/external capabilities with shared picker and viewer.
  Templates and their imagery are Host content, never a bundled catalogue.
  Preserve literal SSR stylesheet output across React 18 and 19 while escaping
  style-tag termination.

### Patch Changes

- 557f55e: Prepare repeatable alpha release verification: reviewed public
  declarations, packed Vite/Next.js and React-major browser checks, source-map
  validation, candidate checksums and alpha-only release guards. Refresh the
  private build and documentation toolchain to remediate dependency advisories.
  Published entry points and Document schema remain unchanged.
- 557f55e: Upgrade bundled validation to Zod 4.6.6 and refresh the development
  and packed consumer dependencies to patched releases. Preserve Document
  validation and standard Element behavior while removing high and critical
  dependency findings.
- ab3317c: Publish the consumer package as `@startupmedia/pagebldr`. Update
  installation instructions, public imports, examples and release checks to use
  that scope.
- 2cb504a: Refine the editor inspector, toolbar, Structure and media controls.
  Add multiline text and local date/time control presentations for Testimonial
  and Countdown.

  Use a fixed 1201px-wide 16:9 desktop canvas while preserving full-width
  desktop, tablet and mobile modes. Add overlay canvas scrolling, a drop shadow,
  smooth selection reveal and persistent bottom sizing controls.

  Improve compact layouts with fitted canvases, floating panels and a Page view
  picker. Keep panel controls readable and let the user open the inspector or
  Add panel explicitly through the selection-aware pencil/plus button.

  Use Update for the default save action, keep status beside the title, and add
  shared canvas/Structure context actions, a rename dialog and iframe-aware
  Delete handling that respects text editing and locked Elements.
