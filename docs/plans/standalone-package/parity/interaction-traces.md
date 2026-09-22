# Interaction acceptance traces

These traces define the human-visible outcomes the Reference Host must support.
Automation may split a trace into smaller tests, but the phase gate runs the
whole journey in sequence against the packed package.

## `TRACE-AUTHOR` — ordinary authoring

1. Open `#/editor`; confirm the seeded page, Saved state and root selection.
2. Search Elements for Heading and click insert.
3. Undo and redo the insertion.
4. Drag a Rich Text Element before the Heading and observe valid placement.
5. Select the Heading from Structure and confirm canvas reveal/synchronization.
6. Double-click the Heading, edit inline and commit.
7. Rename, duplicate, move, indent and outdent it through Structure actions.
8. Copy/paste the subtree, copy/paste style, hide/show and lock/unlock it.
9. Use keyboard-only equivalents for selection, movement and deletion.
10. Jump backward and forward through local Actions and confirm dirty state.

## `TRACE-STYLE` — responsive and stateful design

1. Select a Container and open Style.
2. Author Desktop Typography and Background values using literals and Variables.
3. switch to Tablet and Mobile, observe inherited origins and override values;
4. force Hover and Focus Visible states and author/reset declarations;
5. use Advanced Layout, Size, Spacing, Border, Effects, Position and Visibility;
6. hide only Mobile and confirm editor discoverability plus published omission;
7. reset one property and then all local styles; and
8. confirm preview and published CSS match the authored cascade.

## `TRACE-LIBRARY` — Elements, Blocks and Templates

1. Search across each library tab and apply a category filter.
2. Insert one standard Block by click and another by drag.
3. Save a non-root subtree as a Block, find it, insert it and delete the saved
   record without changing existing content.
4. favourite and preview a Featured Template without mutating the page.
5. apply it explicitly and confirm identity/SEO preservation, root selection and
   Fit zoom.
6. open assigned Templates, preview and apply one.
7. confirm an unassigned managed Template is absent.

## `TRACE-MEDIA` — shared picker and accessibility

1. Open Image selection and move between Add and Gallery without losing state.
2. Drop two permitted files; observe automatic upload, progress and completion.
3. cancel one active upload, retry a deterministic failure and remove it.
4. add a valid HTTPS external URL and reject an invalid URL/kind.
5. search/filter/sort the Gallery and switch masonry/grid/list presentation.
6. preview image and video items without changing pending selection.
7. cancel the picker and confirm the Element did not change.
8. reopen, commit one image and confirm initialized but unconfirmed alt text.
9. build and reorder a mixed image/video Gallery, reaching the 30-item policy.
10. satisfy meaningful/decorative accessibility rules and pass publication
    validation.

## `TRACE-PREVIEW` — local preview

1. Make an unsaved edit and retain the current selection.
2. enter Preview without invoking save;
3. confirm editor chrome below the top bar is removed;
4. attempt a link and confirm navigation remains suppressed; and
5. press Escape/Return to editor and confirm the local edit and selection
   remain.

## `TRACE-LIFECYCLE` — autosave and publication

1. Edit repeatedly within and across the 900ms quiet period.
2. confirm one serialized request at a time and no lost later changes;
3. observe Dirty, Saving and Saved states;
4. trigger a retryable failure and recover without losing Local history;
5. explicitly Save draft and observe one durable save Revision;
6. attempt Publish with broken destinations and unconfirmed meaningful media;
7. resolve validation, Publish, then edit and Update;
8. open the live route and confirm the immutable published snapshot;
9. Unpublish and confirm the draft remains editable; and
10. republish the preserved draft.

## `TRACE-HISTORY` — Actions and Revisions

1. Open History and distinguish local Actions from durable Revisions.
2. jump to an earlier Action and back to the latest position;
3. preview a durable Revision without replacing the editor Document;
4. attempt restore while dirty and observe the save-first requirement;
5. restore a saved Revision and observe a new append-only restore Revision; and
6. confirm the live page is unchanged until a separate Publish.

## `TRACE-CONFLICT` — concurrency and recovery

1. Advance the server revision through the deterministic second-session control.
2. attempt autosave and observe Conflict rather than overwrite;
3. confirm local Document, selection and undo/redo history remain intact;
4. confirm autosave and Publish are paused;
5. download the exact local recovery JSON;
6. reload into a mismatched-revision recovery state and remain in Conflict; and
7. complete explicit resolution/retry of the exact local revision.

## `TRACE-RESPONSIVE-SHELL` — tablet and phone authoring

1. Repeat selection and Content editing at tablet and phone shell widths.
2. open the compact action menu and invoke undo, redo, preview, save, history
   and Page design;
3. open/move/collapse inspector and Structure overlays independently;
4. use bottom Add, zoom, Structure and authored-view controls;
5. confirm all pointer targets are at least 44px; and
6. complete the flow with keyboard only at each shell boundary probe.

## `TRACE-RUNTIME` — published output

1. Resolve the published route and metadata from the Runtime.
2. confirm draft changes never replace the published snapshot;
3. exercise Menu at its configured collapse breakpoint;
4. switch Tabs with pointer and keyboard;
5. advance/expire Countdown deterministically;
6. use square, masonry and carousel Gallery modes, viewer and video pausing;
7. resolve external, anchor, email, telephone and application destinations; and
8. record consent-aware Visit/Interaction events with no editor Audit leakage.

## `TRACE-INSTALL` — developer drop-in experience

1. Create a clean Vite React consumer.
2. install the freshly packed tarball and supported peers;
3. copy only the documented minimal Builder/controlled-state wiring;
4. import `pagebldr/styles.css` and mount the standard preset;
5. confirm the complete styled Default experience and all standard libraries;
6. build, reload and run editor/preview/published routes; and
7. confirm no Host editor CSS, copied source or internal imports exist.
