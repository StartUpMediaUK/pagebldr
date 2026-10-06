"use client";

import { useId } from "react";
import { RotateCcwIcon } from "lucide-react";

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
import { ValidatedInputField } from "./validated-input-field.js";
import { ColorField } from "./color-field.js";

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
  focusVisible: "Focus Visible",
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
  const capabilities = styleCapabilitiesForSection(
    (definition?.styles ?? []).flatMap((key) => {
      const capability = editor.builder.styles.capabilities.get(key);
      return capability ? [capability] : [];
    }),
    section,
  );
  const readOnly = editor.mode !== "edit" || element.locked;

  return (
    <FieldGroup className="pb-6">
      <FieldSet className="gap-3">
        <FieldLegend variant="label">Breakpoint</FieldLegend>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={breakpoint}
          onValueChange={(value) => {
            if (value === "desktop" || value === "tablet" || value === "mobile")
              editor.setViewport(value);
          }}
          aria-label="Authored breakpoint"
        >
          {(Object.keys(breakpointLabels) as Breakpoint[]).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {breakpointLabels[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldSet>

      <FieldSet className="gap-3">
        <FieldLegend variant="label">State</FieldLegend>
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
        >
          {(Object.keys(stateLabels) as StyleState[]).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {stateLabels[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {editor.styleState === "normal" ? null : (
          <FieldDescription>
            The selected Element is forced into this state on the editor canvas.
          </FieldDescription>
        )}
      </FieldSet>

      {capabilities.length === 0 ? (
        <FieldDescription>
          The selected Element does not register controls for this section.
        </FieldDescription>
      ) : null}

      {capabilities.map((capability) => (
        <FieldSet key={capability.key} className="gap-4 rounded-md border p-3">
          <FieldLegend>{capability.label}</FieldLegend>
          {capability.properties.map((property) => (
            <StylePropertyField
              key={property}
              breakpoint={breakpoint}
              element={element}
              property={property}
              readOnly={readOnly}
              state={editor.styleState}
            />
          ))}
        </FieldSet>
      ))}

      <Button
        type="button"
        variant="outline"
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
        Reset all local styles
      </Button>
    </FieldGroup>
  );
}

function StylePropertyField({
  breakpoint,
  element,
  property,
  readOnly,
  state,
}: {
  readonly breakpoint: Breakpoint;
  readonly element: PageElement;
  readonly property: string;
  readonly readOnly: boolean;
  readonly state: StyleState;
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

  const ValueField = kinds.includes("color") ? ColorField : ValidatedInputField;
  return (
    <ValueField
      key={`${element.id}:${breakpoint}:${state}:${property}`}
      label={label}
      value={isPrimitiveStyleValue(local) ? String(local) : ""}
      inputProps={{
        placeholder: formatStyleValue(resolved?.value),
        disabled: readOnly || Boolean(localVariable),
      }}
      disabled={readOnly || Boolean(localVariable)}
      resolvedValue={
        localVariable
          ? String(localVariable.value)
          : isPrimitiveStyleValue(resolved?.value)
            ? String(resolved.value)
            : ""
      }
      onCommit={(draft) => setValue(draft === "" ? null : draft)}
      labelAction={
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Reset ${label}`}
          disabled={readOnly || local === undefined}
          onClick={() => setValue(null)}
        >
          <RotateCcwIcon />
        </Button>
      }
    >
      {variables.length > 0 || localVariable ? (
        <Field>
          <FieldLabel htmlFor={sourceId} className="sr-only">
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
                  ? null
                  : { type: "variable", variableId },
              );
            }}
          >
            <NativeSelectOption value="custom">Custom value</NativeSelectOption>
            {variables.map((variable) => (
              <NativeSelectOption key={variable.id} value={variable.id}>
                {variable.name} · {formatStyleValue(variable.value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <FieldDescription>
        {describeStyleOrigin(editor.document, resolved)}
      </FieldDescription>
    </ValueField>
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
