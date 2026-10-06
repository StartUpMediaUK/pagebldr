# UI source attribution

## shadcn/ui

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

Installed primitives: Alert Dialog, Badge, Button, Dialog, Empty, Field, Input,
Input Group, Popover, Label, Dropdown Menu, Native Select, Resizable, Scroll
Area, Select, Separator, Slider, Switch, Tabs, Textarea, Toggle, Toggle Group,
and Tooltip.

ReUI was not used in this phase because its skill/registry integration was not
available in the active runtime.
