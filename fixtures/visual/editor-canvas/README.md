# Editor canvas visual baselines

Accepted Reference Host captures for Windows Chromium visual regression checks.
CI compares the editor and pencil regions defined in
`etc/canvas-visual-regions.json` when that gate is enabled. Authored remote
imagery outside those regions is excluded from that comparison.

Review visual changes before replacing a baseline. Keep generated captures and
comparison reports in ignored `release-evidence/` output or CI artifacts.
