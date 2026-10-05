import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  LaptopIcon,
  SmartphoneIcon,
  TabletIcon,
  XIcon,
} from "lucide-react";
import type { ElementControl } from "@pagebldr/core";

type Control = ElementControl<Record<string, unknown>>;

export function propertyControlLabel(
  control: Control,
  props: Readonly<Record<string, unknown>>,
): string {
  return (
    control.labelWhen?.find(({ conditions }) =>
      conditions.every(
        ({ key, equals, notEquals }) =>
          (equals === undefined || props[key] === equals) &&
          (notEquals === undefined || props[key] !== notEquals),
      ),
    )?.label ?? control.label
  );
}

/** Semantic presentations, not arbitrary icon keys or Element-type switches. */
export function propertyOptionIcon(
  presentation: Extract<Control, { kind: "select" }>["presentation"],
  value: string | number,
) {
  if (presentation === "viewport") {
    if (value === "desktop") return LaptopIcon;
    if (value === "tablet") return TabletIcon;
    if (value === "mobile") return SmartphoneIcon;
    if (value === "never") return XIcon;
  }
  if (presentation === "horizontal-alignment") {
    if (value === "start") return AlignLeftIcon;
    if (value === "center") return AlignCenterIcon;
    if (value === "end") return AlignRightIcon;
  }
  if (presentation === "vertical-alignment") {
    if (value === "start") return AlignVerticalJustifyStartIcon;
    if (value === "center") return AlignVerticalJustifyCenterIcon;
    if (value === "end") return AlignVerticalJustifyEndIcon;
  }
  return null;
}
