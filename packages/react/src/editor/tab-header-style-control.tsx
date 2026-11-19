"use client";

import { useState, type ReactNode } from "react";
import type { ElementControl, PageElement } from "@pagebldr/core";
import {
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "../components/ui/field.js";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.js";
import { StyleControls } from "./style-control.js";
import { StyleValueField } from "./style-value-field.js";
import { usePagebldrEditor } from "./context.js";

const presets = {
  underline: {
    tabRadius: 0,
    tabIndicatorWidth: 2,
    tabGap: 8,
    tabBackground: "",
    tabActiveBackground: "",
    tabActiveColor: "",
  },
  pills: {
    tabRadius: 100,
    tabIndicatorWidth: 0,
    tabGap: 8,
    tabBackground: "",
    tabActiveBackground: "#202020",
    tabActiveColor: "#ffffff",
  },
  segmented: {
    tabRadius: 6,
    tabIndicatorWidth: 0,
    tabGap: 0,
    tabBackground: "#f4f4f5",
    tabActiveBackground: "#202020",
    tabActiveColor: "#ffffff",
  },
} as const;

export function TabHeaderStyleControl({
  element,
  controls,
  renderControl,
}: {
  readonly element: PageElement;
  readonly controls: readonly ElementControl<Record<string, unknown>>[];
  readonly renderControl: (
    control: ElementControl<Record<string, unknown>>,
  ) => ReactNode;
}) {
  const editor = usePagebldrEditor();
  const [state, setState] = useState<"normal" | "active" | "hover" | "focus">(
    () => (editor.styleState === "focusVisible" ? "focus" : editor.styleState),
  );
  const disabled = editor.mode !== "edit" || element.locked;
  const props = {
    ...(editor.builder.elements.get(element.type)!.defaults() as Record<
      string,
      unknown
    >),
    ...element.props,
  };
  const preset =
    Object.entries(presets).find(([, patch]) =>
      Object.entries(patch).every(([key, value]) => props[key] === value),
    )?.[0] ?? "";
  const field = (key: string, label?: string) => {
    const control = controls.find((control) => control.key === key);
    return control ? (
      <div key={key} className="min-w-0">
        {renderControl(label ? { ...control, label } : control)}
      </div>
    ) : null;
  };
  const alignmentControl = controls.find(
    (control) => control.key === "tabJustifyContent",
  );
  return (
    <>
      <FieldSet className="gap-4 pb-5">
        <FieldLegend>Tab headers</FieldLegend>
        <ToggleGroup
          type="single"
          variant="outline"
          value={preset}
          disabled={disabled}
          aria-label="Header preset"
          className="grid w-full grid-cols-3"
          onValueChange={(value) => {
            if (!Object.hasOwn(presets, value)) return;
            editor.dispatch({
              type: "update-props",
              elementId: element.id,
              patch: presets[value as keyof typeof presets],
            });
          }}
        >
          {(["underline", "pills", "segmented"] as const).map((value) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="h-auto flex-col gap-2 py-3"
              aria-label={value}
            >
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={
                      value === "underline"
                        ? "h-2 w-4 border-b-2 border-current"
                        : value === "pills"
                          ? "h-2 w-4 rounded-full border border-current"
                          : "h-2 w-4 border border-current"
                    }
                  />
                ))}
              </span>
              <span className="text-xs">
                {value === "underline"
                  ? "Underline"
                  : value === "pills"
                    ? "Pills"
                    : "Segmented"}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={state}
          variant="outline"
          size="sm"
          aria-label="Header state"
          className="grid w-full grid-cols-4"
          onValueChange={(value) => {
            if (
              value === "normal" ||
              value === "active" ||
              value === "hover" ||
              value === "focus"
            ) {
              setState(value);
              editor.setStyleState(
                value === "hover"
                  ? "hover"
                  : value === "focus"
                    ? "focusVisible"
                    : "normal",
              );
            }
          }}
        >
          {["normal", "active", "hover", "focus"].map((value) => (
            <ToggleGroupItem key={value} value={value} className="px-1 text-xs">
              {value[0]!.toUpperCase() + value.slice(1)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-3">
          {state === "focus" ? (
            field("tabFocusColor", "Focus ring")
          ) : (
            <>
              {field(
                state === "active"
                  ? "tabActiveColor"
                  : state === "hover"
                    ? "tabHoverColor"
                    : "tabColor",
                "Text",
              )}
              {field(
                state === "active"
                  ? "tabActiveBackground"
                  : state === "hover"
                    ? "tabHoverBackground"
                    : "tabBackground",
                "Fill",
              )}
            </>
          )}
        </div>
        <FieldDescription>
          Clear a colour to inherit. Changes apply to all headers in this Tabs
          group.
        </FieldDescription>
      </FieldSet>
      <StyleControls
        element={element}
        section="style"
        showStateControls={false}
        sections={{
          typography: {
            content: (
              <div className="grid grid-cols-1 gap-4 editor-fields-wide:grid-cols-2">
                {field("tabFontSize", "Size")}
                {field("tabFontWeight", "Weight")}
                {field("tabActiveFontWeight", "Active weight")}
              </div>
            ),
            propKeys: [
              "tabFontSize",
              "tabFontWeight",
              "tabActiveFontWeight",
              ...{
                normal: ["tabColor"],
                active: ["tabActiveColor"],
                hover: ["tabHoverColor"],
                focus: [],
              }[state],
            ],
            omitStyleProperties: ["fontSize", "fontWeight", "color"],
          },
          background: {
            content: field("tabListBackground", "Header background"),
            propKeys: [
              "tabListBackground",
              ...{
                normal: ["tabBackground"],
                active: ["tabActiveBackground"],
                hover: ["tabHoverBackground"],
                focus: [],
              }[state],
            ],
          },
          layout: {
            label: "Layout",
            content: (
              <div className="grid gap-4">
                {alignmentControl?.kind === "select" ? (
                  <StyleValueField
                    property="justifyContent"
                    label={alignmentControl.label}
                    value={String(props.tabJustifyContent)}
                    resolvedValue=""
                    disabled={disabled}
                    onCommit={(value) => {
                      if (
                        value === props.tabJustifyContent ||
                        !alignmentControl.options.some(
                          (option) => option.value === value,
                        )
                      )
                        return;
                      editor.dispatch({
                        type: "update-props",
                        elementId: element.id,
                        patch: { tabJustifyContent: value },
                      });
                    }}
                  />
                ) : null}
                {field("tabGap", "Tab gap")}
              </div>
            ),
            propKeys: ["tabJustifyContent", "tabGap"],
            omitStyleProperties: ["gap"],
          },
          spacing: {
            label: "Spacing",
            content: (
              <div className="grid grid-cols-1 gap-4 editor-fields-wide:grid-cols-2">
                {field("tabPaddingX", "Header horizontal padding")}
                {field("tabPaddingY", "Header vertical padding")}
              </div>
            ),
            propKeys: ["tabPaddingX", "tabPaddingY"],
          },
          border: {
            label: "Border",
            content: (
              <div className="grid grid-cols-1 gap-4 editor-fields-wide:grid-cols-2">
                {field("tabRadius", "Header radius")}
                {field("tabIndicatorWidth", "Active indicator width")}
                {field("tabIndicatorColor", "Active indicator colour")}
              </div>
            ),
            propKeys: [
              "tabRadius",
              "tabIndicatorWidth",
              "tabIndicatorColor",
              ...(state === "focus" ? ["tabFocusColor"] : []),
            ],
            omitStyleProperties: ["borderRadius"],
          },
          behaviour: {
            label: "Behaviour",
            content: (
              <div className="flex flex-col gap-4">
                {field("orientation")}
                {field("labelLayout")}
                {field("activation")}
              </div>
            ),
            propKeys: ["orientation", "labelLayout", "activation"],
          },
        }}
      />
    </>
  );
}
