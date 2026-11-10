# Fixed desktop editor canvas baselines

Windows Chromium captures from CI run 42844408823, commit 6d0b9e4, for the
user-approved editor layout: fixed 1201px 16:9 Desktop, fitted compact canvas,
Update action and floating compact controls. These replace the active comparison
set; the previous captures remain unchanged in `../editor-canvas`.

The interaction suite passed before these captures were reviewed. The comparison
retains the 430px upper region, explicit 24px pencil targets and existing pixel
thresholds. The target positions in
`etc/canvas-visual-regions-fixed-desktop.json` reflect the fixed canvas and
compact fit geometry. Authored remote imagery below the comparison region is
excluded as before. Do not overwrite accepted captures.
