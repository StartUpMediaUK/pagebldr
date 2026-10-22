# pagebldr

## 0.0.0

### Minor Changes

- 3bba3d0: Complete the schema-v2 Document, command, Local history, Destination
  and style engine contracts derived from the Quizr page builder. Replace the
  placeholder standard library with 24 strict, versioned Element definitions,
  package-owned rendering and interactive widgets, media migrations, typed
  Destination resolution, approved fonts, and the full Project Enquiry Reference
  Host. Add the isolated authored canvas, versioned shell bridge, responsive
  authored viewports, zoom/Fit/reveal controls, command-backed inline editing,
  validated drag/drop placement, keyboard movement and local-Document preview.
- fd7d118: Add command-oriented library preparation for independently inserted
  Blocks and cloned Templates. Block preparation preserves customized
  destination design dependencies; Template cloning validates the Document and
  remaps internal Element references with fresh IDs.
- cee9ab2: Add the standard 23-Block catalogue at `pagebldr/library`, a
  searchable editor library, Host-backed saved Blocks and managed Templates, and
  optional Resource media browse/lookup/upload/external capabilities with shared
  picker and viewer. Templates and their imagery are Host content, never a
  bundled catalogue. Preserve literal SSR stylesheet output across React 18 and
  19 while escaping style-tag termination.
