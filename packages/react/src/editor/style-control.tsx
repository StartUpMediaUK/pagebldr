"use client";

import { useId, useState } from "react";
import { ChevronDownIcon, PaletteIcon, RotateCcwIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover.js";

import type {
  Breakpoint,
  PageDocument,
  PageElement,
  ResolvedStyleValue,
  StyleCapabilityDefinition,
  StyleState,
  StyleValue,
  StyleVariable,
} from "@pagebldr/core";

import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.js";
import { usePagebldrEditor, type EditorViewport } from "./context.js";
import { StyleValueField } from "./style-value-field.js";
import { Switch } from "../components/ui/switch.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible.js";
import { replaceStyleProperties } from "./style-layer.js";

const inspectorProperties: Readonly<Record<string, readonly string[]>> = {
  layout: [
    "width",
    "display",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "gap",
    "gridTemplateColumns",
  ],
  size: [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "overflow",
  ],
  typography: [
    "color",
    "fontFamily",
    "fontSize",
    "lineHeight",
    "fontWeight",
    "textAlign",
    "textTransform",
    "textDecoration",
    "letterSpacing",
  ],
  background: [
    "backgroundColor",
    "backgroundImage",
    "backgroundSize",
    "backgroundPosition",
    "backgroundRepeat",
  ],
  border: ["borderWidth", "borderStyle", "borderColor", "borderRadius"],
  effects: [
    "opacity",
    "boxShadow",
    "transform",
    "filter",
    "backdropFilter",
    "transition",
    "cursor",
  ],
  position: ["position", "top", "right", "bottom", "left", "zIndex"],
};

const advancedCapabilities = new Set([
  "layout",
  "spacing",
  "size",
  "position",
  "border",
  "effects",
  "responsive-visibility",
]);

const breakpointLabels: Readonly<Record<Breakpoint, string>> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

const stateLabels: Readonly<Record<StyleState, string>> = {
  normal: "Normal",
  hover: "Hover",
  focusVisible: "Focus",
};

export function styleBreakpointFromViewport(
  viewport: EditorViewport,
): Breakpoint {
  return viewport === "tablet" || viewport === "mobile" ? viewport : "desktop";
}

export function styleCapabilitiesForSection(
  definitions: readonly StyleCapabilityDefinition[],
  section: "style" | "advanced",
): readonly StyleCapabilityDefinition[] {
  return definitions.filter((definition) =>
    section === "advanced"
      ? advancedCapabilities.has(definition.key)
      : !advancedCapabilities.has(definition.key),
  );
}

export function applicableStyleVariables(
  document: PageDocument,
  kinds: readonly StyleVariable["kind"][],
): readonly StyleVariable[] {
  return document.variableOrder
    .map((id) => document.variables[id]!)
    .filter((variable) => kinds.includes(variable.kind));
}

export function describeStyleOrigin(
  document: PageDocument,
  resolved: ResolvedStyleValue | undefined,
): string {
  if (!resolved) return "Not authored at this state or a wider breakpoint.";
  const source = resolved.source;
  const owner =
    source.sourceType === "class"
      ? `Class ${document.classes[source.sourceId]?.name ?? source.sourceId}`
      : "Local";
  const inherited = source.inherited ? " · inherited" : "";
  return `${owner} · ${breakpointLabels[source.breakpoint]} · ${stateLabels[source.state]}${inherited}`;
}

export function StyleControls({
  element,
  section,
}: {
  readonly element: PageElement;
  readonly section: "style" | "advanced";
}) {
  const editor = usePagebldrEditor();
  const breakpoint = styleBreakpointFromViewport(editor.viewport);
  const definition = editor.builder.elements.get(element.type);
  const registeredCapabilities = styleCapabilitiesForSection(
    (definition?.styles ?? []).flatMap((key) => {
      const capability = editor.builder.styles.capabilities.get(key);
      return capability ? [capability] : [];
    }),
    section,
  );
  const moveWidth = registeredCapabilities.some(
    ({ key, properties }) => key === "size" && properties.includes("width"),
  );
  const layoutCapabilities =
    moveWidth && !registeredCapabilities.some(({ key }) => key === "layout")
      ? [
          { key: "layout", label: "Layout", properties: [] },
          ...registeredCapabilities,
        ]
      : registeredCapabilities;
  const order = [
    "typography",
    "background",
    "layout",
    "size",
    "spacing",
    "border",
    "effects",
    "position",
    "responsive-visibility",
  ];
  const capabilities = layoutCapabilities
    .map((capability) =>
      !moveWidth
        ? capability
        : capability.key === "layout"
          ? { ...capability, properties: ["width", ...capability.properties] }
          : capability.key === "size"
            ? {
                ...capability,
                properties: capability.properties.filter(
                  (property) => property !== "width",
                ),
              }
            : capability,
    )
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const readOnly = editor.mode !== "edit" || element.locked;

  return (
    <FieldGroup className="pb-6">
      <div className="flex items-center gap-2">
        <NativeSelect
          size="sm"
          value={breakpoint}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === "desktop" || value === "tablet" || value === "mobile")
              editor.setViewport(value);
          }}
          aria-label="Authored breakpoint"
        >
          {(Object.keys(breakpointLabels) as Breakpoint[]).map((value) => (
            <NativeSelectOption key={value} value={value}>
              {breakpointLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={editor.styleState}
          onValueChange={(value) => {
            if (
              value === "normal" ||
              value === "hover" ||
              value === "focusVisible"
            )
              editor.setStyleState(value);
          }}
          aria-label="Authored interaction state"
          className="order-first flex-1"
        >
          {(Object.keys(stateLabels) as StyleState[]).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {stateLabels[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {editor.styleState === "normal" ? null : (
          <FieldDescription className="sr-only">
            The selected Element is forced into this state on the editor canvas.
          </FieldDescription>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Reset all local styles"
          disabled={readOnly || Object.keys(element.styles).length === 0}
          onClick={() =>
            editor.dispatch({
              type: "replace-styles",
              elementId: element.id,
              styles: {},
            })
          }
        >
          <RotateCcwIcon data-icon="inline-start" />
        </Button>
      </div>

      {capabilities.length === 0 ? (
        <FieldDescription>
          The selected Element does not register controls for this section.
        </FieldDescription>
      ) : null}

      {capabilities.map((capability) => (
        <Collapsible
          key={capability.key}
          defaultOpen={capability.key !== "responsive-visibility"}
          className="border-b"
        >
          <div className="flex items-center gap-2 py-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 justify-start [&[data-state=closed]>svg]:-rotate-90"
              >
                <ChevronDownIcon data-icon="inline-start" />
                {capability.label}
              </Button>
            </CollapsibleTrigger>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                readOnly ||
                !capability.properties.some(
                  (property) =>
                    element.styles[breakpoint]?.[editor.styleState]?.[
                      property
                    ] !== undefined,
                )
              }
              aria-label={`Reset ${capability.label} section`}
              onClick={() =>
                editor.dispatch({
                  type: "replace-styles",
                  elementId: element.id,
                  styles: replaceStyleProperties(
                    element.styles,
                    breakpoint,
                    editor.styleState,
                    capability.properties,
                    null,
                  ),
                })
              }
            >
              Reset
            </Button>
          </div>
          <CollapsibleContent>
            <FieldGroup className="gap-4 px-3 pb-4">
              {capability.key === "spacing" ? (
                <SpacingControls
                  element={element}
                  breakpoint={breakpoint}
                  state={editor.styleState}
                  readOnly={readOnly}
                  properties={capability.properties}
                />
              ) : capability.key === "responsive-visibility" ? (
                <VisibilityControls element={element} readOnly={readOnly} />
              ) : (
                (inspectorProperties[capability.key] ?? capability.properties)
                  .filter((property) =>
                    capability.properties.includes(property),
                  )
                  .map((property) => (
                    <StylePropertyField
                      key={property}
                      breakpoint={breakpoint}
                      element={element}
                      property={property}
                      readOnly={readOnly}
                      state={editor.styleState}
                    />
                  ))
              )}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </FieldGroup>
  );
}

function StylePropertyField({
  breakpoint,
  element,
  property,
  readOnly,
  state,
  onSet,
}: {
  readonly breakpoint: Breakpoint;
  readonly element: PageElement;
  readonly property: string;
  readonly readOnly: boolean;
  readonly state: StyleState;
  readonly onSet?:
    ((property: string, value: StyleValue | null) => void) | undefined;
}) {
  const editor = usePagebldrEditor();
  const id = useId();
  const sourceId = `${id}-source`;
  const local = element.styles[breakpoint]?.[state]?.[property];
  const resolved = editor.builder.styles.resolve(
    editor.document,
    element.id,
    breakpoint,
    state,
  )[property];
  const kinds = editor.builder.styles.variableKindsForProperty(property);
  const variables = applicableStyleVariables(editor.document, kinds);
  const localVariable = isVariableReference(local)
    ? editor.document.variables[local.variableId]
    : undefined;
  const label = propertyLabel(property);
  const setValue = (value: StyleValue | null) => {
    if (
      value === local ||
      (value === null && local === undefined) ||
      (value !== null &&
        isVariableReference(value) &&
        isVariableReference(local) &&
        value.variableId === local.variableId)
    )
      return;
    if (onSet) {
      onSet(property, value);
      return;
    }
    editor.dispatch(
      {
        type: "set-style",
        target: { type: "local", elementId: element.id },
        breakpoint,
        state,
        property,
        value,
      },
      `style:${element.id}:${breakpoint}:${state}:${property}`,
    );
  };

  return (
    <div title={describeStyleOrigin(editor.document, resolved)}>
      <StyleValueField
        property={property}
        key={`${element.id}:${breakpoint}:${state}:${property}`}
        label={label}
        value={isPrimitiveStyleValue(local) ? String(local) : ""}
        disabled={readOnly || Boolean(localVariable)}
        resolvedValue={
          localVariable
            ? String(localVariable.value)
            : isPrimitiveStyleValue(resolved?.value)
              ? String(resolved.value)
              : isVariableReference(resolved?.value)
                ? String(
                    editor.document.variables[resolved.value.variableId]
                      ?.value ?? "",
                  )
                : ""
        }
        onCommit={(draft) => setValue(draft === "" ? null : draft)}
        labelAction={
          <div className="flex items-center gap-1">
            {variables.length > 0 || localVariable ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={readOnly}
                    aria-label={`Choose ${label} value source`}
                  >
                    <PaletteIcon data-icon="inline-start" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64"
                  aria-label={`${label} value source`}
                  onEscapeKeyDown={(event) => event.stopPropagation()}
                >
                  <Field>
                    <FieldLabel htmlFor={sourceId}>
                      {label} value source
                    </FieldLabel>
                    <NativeSelect
                      id={sourceId}
                      size="sm"
                      value={localVariable?.id ?? "custom"}
                      disabled={readOnly}
                      onChange={(event) => {
                        const variableId = event.currentTarget.value;
                        setValue(
                          variableId === "custom"
                            ? (localVariable?.value ?? null)
                            : { type: "variable", variableId },
                        );
                      }}
                    >
                      <NativeSelectOption value="custom">
                        Custom value
                      </NativeSelectOption>
                      {variables.map((variable) => (
                        <NativeSelectOption
                          key={variable.id}
                          value={variable.id}
                        >
                          {variable.name} · {formatStyleValue(variable.value)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </PopoverContent>
              </Popover>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Reset ${label}`}
              disabled={readOnly || local === undefined}
              onClick={() => setValue(null)}
            >
              <RotateCcwIcon data-icon="inline-start" />
            </Button>
          </div>
        }
      >
        <FieldDescription className="sr-only">
          {describeStyleOrigin(editor.document, resolved)}
        </FieldDescription>
      </StyleValueField>
    </div>
  );
}

function SpacingControls({
  element,
  breakpoint,
  state,
  readOnly,
  properties,
}: {
  readonly element: PageElement;
  readonly breakpoint: Breakpoint;
  readonly state: StyleState;
  readonly readOnly: boolean;
  readonly properties: readonly string[];
}) {
  return (
    <FieldGroup>
      {(["margin", "padding"] as const)
        .filter((kind) =>
          properties.some((property) => property.startsWith(kind)),
        )
        .map((kind) => (
          <LinkedSpacing
            key={`${element.id}:${breakpoint}:${state}:${kind}`}
            element={element}
            breakpoint={breakpoint}
            state={state}
            readOnly={readOnly}
            kind={kind}
            allowedProperties={properties}
          />
        ))}
    </FieldGroup>
  );
}

function LinkedSpacing({
  element,
  breakpoint,
  state,
  readOnly,
  kind,
  allowedProperties,
}: {
  readonly element: PageElement;
  readonly breakpoint: Breakpoint;
  readonly state: StyleState;
  readonly readOnly: boolean;
  readonly kind: "margin" | "padding";
  readonly allowedProperties: readonly string[];
}) {
  const editor = usePagebldrEditor();
  const properties = ["Top", "Right", "Bottom", "Left"]
    .map((side) => `${kind}${side}`)
    .filter((property) => allowedProperties.includes(property));
  const [linked, setLinked] = useState(
    () =>
      new Set(
        properties.map((property) =>
          JSON.stringify(element.styles[breakpoint]?.[state]?.[property]),
        ),
      ).size <= 1,
  );
  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">
        {kind === "margin"
          ? "Margin (outside space)"
          : "Padding (inside space)"}
      </FieldLegend>
      <Field orientation="horizontal">
        <FieldLabel>Link {kind} sides</FieldLabel>
        <Switch
          aria-label={`Link ${kind} sides`}
          disabled={readOnly}
          checked={linked}
          onCheckedChange={setLinked}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {properties.map((property) => (
          <StylePropertyField
            key={property}
            element={element}
            breakpoint={breakpoint}
            state={state}
            property={property}
            readOnly={readOnly}
            onSet={
              linked
                ? (_, value) =>
                    editor.dispatch(
                      {
                        type: "replace-styles",
                        elementId: element.id,
                        styles: replaceStyleProperties(
                          element.styles,
                          breakpoint,
                          state,
                          properties,
                          value,
                        ),
                      },
                      `style:${element.id}:${breakpoint}:${state}:${kind}-sides`,
                    )
                : undefined
            }
          />
        ))}
      </div>
    </FieldSet>
  );
}

function VisibilityControls({
  element,
  readOnly,
}: {
  readonly element: PageElement;
  readonly readOnly: boolean;
}) {
  const editor = usePagebldrEditor();
  return (
    <FieldGroup>
      {(["desktop", "tablet", "mobile"] as const).map((breakpoint) => (
        <Field key={breakpoint} orientation="horizontal">
          <FieldLabel>Hide on {breakpointLabels[breakpoint]}</FieldLabel>
          <Switch
            aria-label={`Hide on ${breakpointLabels[breakpoint]}`}
            disabled={readOnly}
            checked={element.styles[breakpoint]?.normal?.display === "none"}
            onCheckedChange={(hidden) =>
              editor.dispatch({
                type: "set-style",
                target: { type: "local", elementId: element.id },
                breakpoint,
                state: "normal",
                property: "display",
                value: hidden ? "none" : null,
              })
            }
          />
        </Field>
      ))}
    </FieldGroup>
  );
}

function propertyLabel(property: string): string {
  return property
    .replace(/([A-Z])/gu, " $1")
    .replace(/^./u, (character) => character.toUpperCase());
}

function isVariableReference(
  value: StyleValue | undefined,
): value is Extract<StyleValue, object> {
  return typeof value === "object" && value?.type === "variable";
}

function isPrimitiveStyleValue(
  value: StyleValue | undefined,
): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function formatStyleValue(value: StyleValue | undefined): string {
  if (value === undefined) return "Not set";
  return isVariableReference(value)
    ? `Variable: ${value.variableId}`
    : String(value);
}
