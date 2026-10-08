# UI source attribution

## shadcn/ui

Parity Phase 6 adds Card from the official Radix `@shadcn/card` registry,
installed with the workspace's pnpm runner on 2026-10-07. The full source was
reviewed for imports, license, semantic structure and styling; its `cn` import
was corrected to the existing package utility. The CLI's unintended `cn`
dependency was removed. Tabs, Dialog, Button, Field, Input, Select and Scroll
Area reuse the existing reviewed primitives; their current official component
documentation was checked before composition. ReUI's skill was unavailable; no
ReUI code was installed.

On 2026-10-08 the existing Dialog source gained opener-focus restoration for
controlled dialogs opened without DialogTrigger, using the documented Radix
auto-focus callbacks and preserving explicit caller overrides. The keyboard
review exercises Tab-only navigation, commit/Escape and return focus.

Editor primitives under `packages/react/src/components/ui/` were installed as
source with the shadcn CLI from the official `@shadcn` registry on 2026-08-14.
The selected registry style is New York with Radix primitives and Lucide icons.
shadcn/ui is MIT licensed. Registry source was reviewed after installation;
package-local modifications and compositions are maintained as pagebldr source.
Alert Dialog was added from the same official registry on 2026-10-02 and adapted
to the existing package imports after registry review. Slider was added from the
official registry on 2026-10-05. Review retained the existing `radix-ui`
dependency, replaced the registry's new `cn` dependency with the package's
existing utility, forwarded accessible names to its thumbs, and used semantic
background and reduced-motion styling. No new dependency remains.

Popover and Input Group were added from the official registry on 2026-10-06.
Every added file was reviewed; imports use the existing package utility and
primitives, Popover has reduced-motion support, and its title renders a heading.
Existing Button/Input/Textarea source was not overwritten. The original,
package-owned colour composition characterizes the pinned source's HSL square
mapping without vendoring Kibo UI code. It uses `color@5.0.3` (MIT); bundled
transitive colour-library notices ship in `THIRD_PARTY_NOTICES.md`.

Collapsible was added from the official Radix shadcn registry on 2026-10-06. All
installed source was reviewed and adapted to package-local imports and type-only
React imports. It reuses the existing Radix dependency, adds no new dependency,
and supplies keyboard-operable inspector section disclosures. Input Group's
focus delegation now leaves unit selects and other interactive children in
control of their own focus, including React portal clicks outside the addon's
DOM. On 2026-10-07 inspector choices were composed from the existing reviewed
Select source with SelectGroup/SelectItem, rather than installing another
registry implementation. The private adapter preserves controlled values,
disabled choices, labelled triggers and inherited empty choices.

Installed primitives: Alert Dialog, Badge, Button, Card, Collapsible, Dialog,
Empty, Field, Input, Input Group, Popover, Label, Dropdown Menu, Native Select,
Resizable, Scroll Area, Select, Separator, Slider, Switch, Tabs, Textarea,
Toggle, Toggle Group, and Tooltip.

ReUI was not used in this phase because its skill/registry integration was not
available in the active runtime.
