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

Installed primitives: Alert Dialog, Badge, Button, Dialog, Empty, Field, Input,
Label, Dropdown Menu, Native Select, Resizable, Scroll Area, Select, Separator,
Slider, Switch, Tabs, Textarea, Toggle, Toggle Group, and Tooltip.

ReUI was not used in this phase because its skill/registry integration was not
available in the active runtime.
