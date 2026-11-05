---
"pagebldr": minor
---

Always mount the controlled editor shell. Remove the provisional
`PagebldrEditor.children` replacement prop, which bypassed editor context and
behavior. Move custom editor surfaces into Contributions placed by a Preset. The
packed consumer now verifies this public extension path and rejects the old
replacement prop. Correct the minimal setup to register the standard Elements,
style capabilities and Blocks explicitly.
