# Phase audits

Create one audit after completing each phase of the
[standalone package plan](../plan.md):

```text
phase-0.md
phase-1.md
...
phase-12.md
```

Each audit records the outcome, files and schema changes, public-interface
changes, user-visible behavior, verification performed, checks that could not
run, deferred work, risks, and implementation commit when one exists.
Product-owner review is required before the next phase begins.

Current parity audits:

- [Parity Phase 0](parity-phase-0.md)
- [Parity Phase 1](parity-phase-1.md)
- [Parity Phase 2](parity-phase-2.md)

The Quizr experience correction uses `parity-phase-<n>.md`. These audits add
acceptance-case IDs, interaction traces, packed Reference Host evidence and
visual comparisons to the existing outcome/interface/verification record.
