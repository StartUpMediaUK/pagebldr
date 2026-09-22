# Visual acceptance matrix

This matrix fixes the browser sizes and named states used to compare the
Reference Host with the Quizr source-of-truth evidence. Browser screenshots use
the T3 Code embedded browser unless that environment is explicitly unavailable.

## Shell viewports

| ID             | Width × height | Shell class   | Purpose                                                                                                |
| -------------- | -------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `VP-DESKTOP-L` | 1440 × 900     | Desktop       | Primary fidelity baseline with full toolbar, persistent inspector, floating Structure and zoom island. |
| `VP-DESKTOP-S` | 1280 × 800     | Desktop       | Constrained desktop layout and panel/canvas competition.                                               |
| `VP-TABLET-P`  | 820 × 1180     | Tablet        | Compact header, overlays, bottom toolbar and touch targets in portrait.                                |
| `VP-TABLET-L`  | 1180 × 820     | Desktop shell | Boundary behavior above 1024 while height is constrained.                                              |
| `VP-PHONE`     | 390 × 844      | Phone         | Primary phone authoring surface and 44px touch targets.                                                |
| `VP-PHONE-S`   | 375 × 667      | Phone         | Short phone, keyboard/focus and overlay scrolling pressure.                                            |

The shell boundary probes are 1023/1024px and 767/768px wide. Tests assert the
intended layout on both sides. These shell widths are independent from the
Document's authored Desktop/Tablet/Mobile breakpoints.

## Required screenshot states

| Evidence ID | Route/state                                                        | Required viewports           | Source comparison                                            |
| ----------- | ------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------ |
| `VIS-01`    | Default editor, Elements library and open Structure                | Desktop L/S, Tablet P, Phone | Research screenshot 01 and Editor experience: Shell anatomy. |
| `VIS-02`    | Blocks library with search/category result                         | Desktop L, Phone             | Research screenshot 02.                                      |
| `VIS-03`    | Featured Templates and assigned Templates                          | Desktop L, Tablet P          | Research screenshot 03.                                      |
| `VIS-04`    | Selected Heading and Content inspector                             | Desktop L, Phone             | Research screenshot 04.                                      |
| `VIS-05`    | Selected Container, Style, Hover state, Tablet authored breakpoint | Desktop L                    | Research screenshot 05.                                      |
| `VIS-06`    | Selected Container, Advanced Layout/Size controls                  | Desktop L, Phone             | Research screenshot 06.                                      |
| `VIS-07`    | Media Gallery picker with pending selection                        | Desktop L, Tablet P, Phone   | Research screenshot 08.                                      |
| `VIS-08`    | Page design Variables with usage counts                            | Desktop L, Phone             | Research screenshot 09.                                      |
| `VIS-09`    | History Revisions with live badge and restore action               | Desktop L, Tablet P          | Research screenshot 10.                                      |
| `VIS-10`    | Preview of unsaved local Document                                  | Desktop L, Phone             | Editor experience: Preview.                                  |
| `VIS-11`    | Read-only banner with inspector/Structure available                | Desktop L, Phone             | Editor experience: Read-only presentation.                   |
| `VIS-12`    | Save failure and retry                                             | Desktop L                    | Persistence: Autosave and failures.                          |
| `VIS-13`    | Conflict with recovery actions                                     | Desktop L, Phone             | Persistence: Conflicts and recovery.                         |
| `VIS-14`    | Published page with interactive Menu/Tabs/Gallery                  | Desktop L, Tablet P, Phone   | Media and runtime: Shared renderer.                          |
| `VIS-15`    | Empty, loading, unknown Element and Resource failure states        | Desktop L                    | Editor and runtime error requirements.                       |

## Visual comparison rule

Layout regions, control hierarchy, density, interaction affordances, responsive
choreography and state presentation must match the source experience. Neutral
theme tokens may replace product branding. Any other visible difference is a
defect or an explicitly approved, documented neutralization.

Each image comparison records one of:

- **match** — no unexplained material difference;
- **approved neutralization** — product-specific content or branding was
  replaced without changing behavior or hierarchy; or
- **fail** — a missing, rearranged, unstyled or behaviorally different surface.

An implementation does not pass because it is subjectively polished.
