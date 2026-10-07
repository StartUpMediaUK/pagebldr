"use client";

import { useId, useState, type ReactNode } from "react";
import { standardFontFamilies } from "@pagebldr/core";
import {
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
  Rows3Icon,
  Columns2Icon,
  StretchHorizontalIcon,
  BetweenHorizontalStartIcon,
  SpaceIcon,
} from "lucide-react";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.js";
import { Button } from "../components/ui/button.js";
import {
  InspectorSelect as NativeSelect,
  InspectorSelectOption as NativeSelectOption,
} from "./inspector-select.js";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.js";
import { Switch } from "../components/ui/switch.js";
import { ColorField } from "./color-field.js";
import {
  ValidatedInputField,
  commitInputDraft,
} from "./validated-input-field.js";
import { SliderField } from "./slider-field.js";
import { parseNumberDraft } from "./validated-input-field.js";
import {
  backgroundLayers,
  buildBackgroundLayers,
  buildEffect,
  effectValues,
  formatLength,
  parseLength,
  type BackgroundLayers,
  type EffectProperty,
} from "./style-input-values.js";

const options = (values: readonly (string | readonly [string, string])[]) =>
  values.map((value) =>
    typeof value === "string"
      ? { value, label: value }
      : { value: value[0], label: value[1] },
  );
export const styleChoices: Readonly<
  Record<string, readonly { value: string; label: string }[]>
> = {
  display: options([
    ["flex", "Flex (row or column)"],
    ["grid", "Grid"],
    ["block", "Block"],
    ["inline-block", "Inline"],
  ]),
  alignItems: options([
    ["flex-start", "Start"],
    ["center", "Centre"],
    ["flex-end", "End"],
    ["stretch", "Stretch"],
  ]),
  justifyContent: options([
    ["flex-start", "Start"],
    ["center", "Centre"],
    ["flex-end", "End"],
    ["space-between", "Space between"],
    ["space-around", "Space around"],
    ["space-evenly", "Space evenly"],
  ]),
  gridTemplateColumns: options([
    ["minmax(0, 1fr)", "1 column"],
    ["repeat(2, minmax(0, 1fr))", "2 columns"],
    ["repeat(3, minmax(0, 1fr))", "3 columns"],
    ["repeat(4, minmax(0, 1fr))", "4 columns"],
    ["minmax(0, 2fr) minmax(0, 3fr)", "40 / 60"],
    ["minmax(0, 3fr) minmax(0, 2fr)", "60 / 40"],
  ]),
  overflow: options([
    ["visible", "Visible"],
    ["hidden", "Clip"],
    ["auto", "Scroll if needed"],
  ]),
  fontFamily: standardFontFamilies,
  fontWeight: options([
    ["400", "Regular"],
    ["500", "Medium"],
    ["600", "Semibold"],
    ["700", "Bold"],
    ["800", "Extra bold"],
  ]),
  textTransform: options([
    ["none", "As typed"],
    ["uppercase", "UPPERCASE"],
    ["capitalize", "Capitalize Each Word"],
  ]),
  backgroundSize: options([
    ["cover", "Fill and crop"],
    ["contain", "Fit inside"],
    ["auto", "Original size"],
  ]),
  backgroundPosition: options(["center", "top", "bottom", "left", "right"]),
  borderStyle: options(["solid", "dashed", "dotted"]),
  transition: options([
    ["none", "None"],
    ["all 0.15s ease", "Quick"],
    ["all 0.3s ease", "Smooth"],
  ]),
  cursor: options([
    ["default", "Default"],
    ["pointer", "Pointer"],
    ["not-allowed", "Not allowed"],
  ]),
  position: options([
    ["static", "In normal flow"],
    ["relative", "Relative"],
    ["absolute", "Absolute"],
    ["fixed", "Fixed to screen"],
    ["sticky", "Sticky"],
  ]),
};
const iconChoices = {
  textAlign: [
    { value: "left", label: "Left", icon: AlignLeftIcon },
    { value: "center", label: "Centre", icon: AlignCenterIcon },
    { value: "right", label: "Right", icon: AlignRightIcon },
    { value: "justify", label: "Justify", icon: AlignJustifyIcon },
  ],
  flexDirection: [
    { value: "column", label: "Stack vertically", icon: Rows3Icon },
    { value: "row", label: "Place side by side", icon: Columns2Icon },
  ],
  alignItems: [
    { value: "flex-start", label: "Start", icon: AlignLeftIcon },
    { value: "center", label: "Centre", icon: AlignCenterIcon },
    { value: "flex-end", label: "End", icon: AlignRightIcon },
    { value: "stretch", label: "Stretch", icon: StretchHorizontalIcon },
  ],
  justifyContent: [
    { value: "flex-start", label: "Start", icon: AlignLeftIcon },
    { value: "center", label: "Centre", icon: AlignCenterIcon },
    { value: "flex-end", label: "End", icon: AlignRightIcon },
    {
      value: "space-between",
      label: "Space between",
      icon: BetweenHorizontalStartIcon,
    },
    { value: "space-around", label: "Space around", icon: SpaceIcon },
    { value: "space-evenly", label: "Space evenly", icon: AlignJustifyIcon },
  ],
};
const switches: Readonly<Record<string, readonly [string, string]>> = {
  flexWrap: ["wrap", "nowrap"],
  textDecoration: ["underline", "none"],
  backgroundRepeat: ["repeat", "no-repeat"],
};
export function styleUnits(property: string): readonly string[] | undefined {
  if (
    /^(margin|padding)(Top|Right|Bottom|Left)?$/.test(property) ||
    property === "gap"
  )
    return ["%", "px", "rem"];
  if (
    /^(min|max)?(Width|Height)$/.test(property) ||
    ["width", "height", "top", "right", "bottom", "left"].includes(property)
  )
    return ["%", "px", "rem", "vh", "vw"];
  if (property === "fontSize") return ["px", "rem"];
  if (property === "lineHeight") return ["", "px"];
  if (property === "letterSpacing") return ["px", "em"];
  if (property === "borderWidth") return ["px"];
  if (property === "borderRadius") return ["px", "%"];
  if (property === "zIndex") return [""];
  return undefined;
}

type ValueProps = {
  readonly property: string;
  readonly label: string;
  readonly value: string;
  readonly resolvedValue: string;
  readonly disabled: boolean;
  readonly onCommit: (value: string) => void;
  readonly labelAction?: ReactNode;
  readonly children?: ReactNode;
};

/** Private composition over the same public Style command and registry contract. */
export function StyleValueField(props: ValueProps) {
  const { property, value, resolvedValue, disabled, onCommit } = props;
  if (["color", "backgroundColor", "borderColor"].includes(property))
    return <ColorField {...props} />;
  if (property === "backgroundImage") return <BackgroundField {...props} />;
  if (["transform", "filter", "backdropFilter", "boxShadow"].includes(property))
    return <EffectField {...props} property={property as EffectProperty} />;
  if (property === "width") return <WidthField {...props} />;
  if (property === "opacity")
    return (
      <SliderField
        label={props.label}
        labelAction={props.labelAction}
        value={Math.round(Number(value || resolvedValue || "1") * 100)}
        min={0}
        max={100}
        unit="%"
        disabled={disabled}
        onCommit={(next) => onCommit((next / 100).toFixed(2))}
      >
        {props.children}
      </SliderField>
    );
  const toggle = iconChoices[property as keyof typeof iconChoices];
  if (toggle)
    return (
      <ValueFrame {...props} footer={props.children}>
        {(id, commit, validity) => (
          <ToggleGroup
            {...validity}
            id={id}
            aria-label={props.label}
            type="single"
            variant="outline"
            size="sm"
            disabled={disabled}
            value={value}
            onValueChange={commit}
          >
            {toggle.map(({ value: option, label, icon: Icon }) => (
              <ToggleGroupItem key={option} value={option} aria-label={label}>
                <Icon data-icon="inline-start" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </ValueFrame>
    );
  const switchValues = switches[property];
  if (switchValues)
    return (
      <ValueFrame {...props} footer={props.children}>
        {(id, commit, validity) => (
          <Switch
            {...validity}
            id={id}
            disabled={disabled}
            checked={(value || resolvedValue) === switchValues[0]}
            onCheckedChange={(checked) => commit(switchValues[checked ? 0 : 1])}
          />
        )}
      </ValueFrame>
    );
  const choices = styleChoices[property];
  if (choices)
    return (
      <ValueFrame {...props} footer={props.children}>
        {(id, commit, validity) => (
          <NativeSelect
            {...validity}
            id={id}
            disabled={disabled}
            value={value}
            onChange={(event) => commit(event.currentTarget.value)}
          >
            <NativeSelectOption value="">
              {resolvedValue ? `Inherited: ${resolvedValue}` : "Default"}
            </NativeSelectOption>
            {value && !choices.some((option) => option.value === value) ? (
              <NativeSelectOption value={value}>
                Custom: {value}
              </NativeSelectOption>
            ) : null}
            {choices.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </ValueFrame>
    );
  const units = styleUnits(property);
  if (units) return <UnitField {...props} units={units} />;
  return (
    <ValidatedInputField
      {...props}
      inputProps={{ disabled, placeholder: resolvedValue }}
    />
  );
}

function ValueFrame({
  children: control,
  ...props
}: Omit<ValueProps, "children"> & {
  readonly children: (
    id: string,
    commit: (value: string) => void,
    validity: {
      "aria-invalid": boolean | undefined;
      "aria-describedby": string | undefined;
    },
  ) => ReactNode;
  readonly footer?: ReactNode;
}) {
  const id = useId();
  const [error, setError] = useState<{
    source: string;
    message: string | null;
  }>({ source: props.value, message: null });
  const message = error.source === props.value ? error.message : null;
  return (
    <Field
      data-disabled={props.disabled || undefined}
      data-invalid={Boolean(message) || undefined}
    >
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={id} className="flex-1">
          {props.label}
        </FieldLabel>
        {props.labelAction}
      </div>
      <div>
        {control(
          id,
          (value) => {
            const message = commitInputDraft(value, props.onCommit);
            setError({ source: props.value, message });
          },
          {
            "aria-invalid": Boolean(message) || undefined,
            "aria-describedby": message ? `${id}-error` : undefined,
          },
        )}
      </div>
      {message ? <FieldError id={`${id}-error`}>{message}</FieldError> : null}
      {props.footer}
    </Field>
  );
}

export function UnitField({
  units,
  ...props
}: ValueProps & { readonly units: readonly string[] }) {
  const unitErrorId = useId();
  const [unitError, setUnitError] = useState<{
    source: string;
    message: string | null;
  }>({ source: props.value, message: null });
  const message = unitError.source === props.value ? unitError.message : null;
  const parsed = parseLength(props.value);
  const resolved = parseLength(props.resolvedValue);
  const keywords =
    props.property.startsWith("margin") || props.property === "height"
      ? ["auto"]
      : props.property.startsWith("max")
        ? ["none"]
        : [];
  const keyword = keywords.includes(props.value);
  const unit =
    parsed.amount !== null && units.includes(parsed.unit)
      ? parsed.unit
      : (units[0] ?? "");
  return (
    <ValidatedInputField
      label={props.label}
      value={keyword ? "" : (parsed.amount?.toString() ?? "")}
      labelAction={props.labelAction}
      inputProps={{
        disabled: props.disabled || keyword,
        placeholder: resolved.amount?.toString() ?? "—",
        type: "number",
        step: "any",
      }}
      onCommit={(draft) =>
        props.onCommit(draft === "" ? "" : formatLength(draft, unit))
      }
      inputTrailing={
        <NativeSelect
          aria-label={`${props.label} unit`}
          aria-invalid={Boolean(message) || undefined}
          aria-describedby={message ? unitErrorId : undefined}
          size="sm"
          disabled={props.disabled}
          value={keyword ? props.value : unit}
          onChange={(event) => {
            const next = event.currentTarget.value;
            const message = commitInputDraft(next, () =>
              props.onCommit(
                keywords.includes(next) ? next : `${parsed.amount ?? 0}${next}`,
              ),
            );
            setUnitError({ source: props.value, message });
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && message) {
              event.preventDefault();
              event.stopPropagation();
              setUnitError({ source: props.value, message: null });
            }
          }}
        >
          {[...new Set([...units, ...keywords])].map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option || "Unit"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      }
    >
      {message ? <FieldError id={unitErrorId}>{message}</FieldError> : null}
      {props.children}
    </ValidatedInputField>
  );
}

function WidthField(props: ValueProps) {
  const mode = !props.value
    ? "default"
    : props.value === "100%"
      ? "full"
      : props.value === "fit-content"
        ? "inline"
        : "custom";
  const parsed = parseLength(props.value);
  const unit = ["%", "px", "rem"].includes(parsed.unit) ? parsed.unit : "%";
  const max = unit === "%" ? 100 : unit === "px" ? 2400 : 150;
  return (
    <ValueFrame {...props} footer={props.children}>
      {(id, commit, validity) => (
        <FieldGroup className="gap-3">
          <NativeSelect
            {...validity}
            id={id}
            disabled={props.disabled}
            value={mode}
            onChange={(event) => {
              const mode = event.currentTarget.value;
              commit(
                mode === "default"
                  ? ""
                  : mode === "full"
                    ? "100%"
                    : mode === "inline"
                      ? "fit-content"
                      : mode === "custom" &&
                          props.value !== "100%" &&
                          parseLength(props.value).amount !== null
                        ? props.value
                        : "50%",
              );
            }}
          >
            <NativeSelectOption value="default">Default</NativeSelectOption>
            <NativeSelectOption value="full">Full width</NativeSelectOption>
            <NativeSelectOption value="inline">Inline</NativeSelectOption>
            <NativeSelectOption value="custom">Custom</NativeSelectOption>
          </NativeSelect>
          {mode === "custom" ? (
            <FieldGroup className="gap-3">
              <SliderField
                label="Custom width"
                value={Math.min(max, Math.max(0, parsed.amount ?? 50))}
                min={0}
                max={max}
                step={unit === "rem" ? 0.25 : 1}
                unit={unit}
                disabled={props.disabled}
                onCommit={(amount) => props.onCommit(`${amount}${unit}`)}
              />
              <UnitField
                {...props}
                label="Custom width value"
                labelAction={undefined}
                children={undefined}
                units={["%", "px", "rem"]}
                onCommit={(value) => {
                  const next = parseLength(value);
                  const maximum =
                    next.unit === "%" ? 100 : next.unit === "px" ? 2400 : 150;
                  if (
                    next.amount !== null &&
                    (next.amount < 0 || next.amount > maximum)
                  )
                    throw new Error(
                      `Enter a width from 0 to ${maximum}${next.unit}.`,
                    );
                  props.onCommit(value);
                }}
              />
            </FieldGroup>
          ) : null}
        </FieldGroup>
      )}
    </ValueFrame>
  );
}

function BackgroundField(props: ValueProps) {
  const parsed = backgroundLayers(props.value);
  const [draft, setDraft] = useState({
    source: props.value,
    mode: parsed.mode,
  });
  const mode = draft.source === props.value ? draft.mode : parsed.mode;
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<BackgroundLayers>) => {
    const next = { ...parsed, mode, ...patch };
    const message = commitInputDraft("", () =>
      props.onCommit(buildBackgroundLayers(next) ?? ""),
    );
    setError(message);
    if (message) throw new Error(message);
  };
  return (
    <ValueFrame {...props} footer={props.children}>
      {() => (
        <FieldGroup
          className="gap-3"
          onKeyDownCapture={(event) => {
            if (event.key === "Escape") setError(null);
          }}
        >
          <ToggleGroup
            aria-label="Background layers"
            type="single"
            variant="outline"
            size="sm"
            disabled={props.disabled}
            value={mode}
            onValueChange={(next) => {
              if (!["none", "image", "gradient", "overlay"].includes(next))
                return;
              const nextMode = next as BackgroundLayers["mode"];
              if (
                nextMode === "none" ||
                nextMode === "gradient" ||
                parsed.image
              ) {
                const message = commitInputDraft("", () =>
                  change({ mode: nextMode }),
                );
                if (message) return;
              }
              setDraft({ source: props.value, mode: nextMode });
            }}
          >
            <ToggleGroupItem value="none">None</ToggleGroupItem>
            <ToggleGroupItem value="image">Image</ToggleGroupItem>
            <ToggleGroupItem value="gradient">Gradient</ToggleGroupItem>
            <ToggleGroupItem value="overlay">Overlay</ToggleGroupItem>
          </ToggleGroup>
          {mode === "gradient" || mode === "overlay" ? (
            <>
              <ColorField
                label="Gradient start colour"
                value={parsed.start}
                disabled={props.disabled}
                encoding="hex"
                onCommit={(start) => change({ start })}
              />
              <ColorField
                label="Gradient end colour"
                value={parsed.end}
                disabled={props.disabled}
                encoding="hex"
                onCommit={(end) => change({ end })}
              />
              <ValidatedInputField
                label="Gradient angle"
                value={String(parsed.angle)}
                inputProps={{
                  type: "number",
                  min: -360,
                  max: 360,
                  disabled: props.disabled,
                }}
                onCommit={(angle) =>
                  change({ angle: parseNumberDraft(angle, -360, 360) })
                }
              />
            </>
          ) : null}
          {mode === "image" || mode === "overlay" ? (
            <ValidatedInputField
              label="Background image URL"
              value={parsed.image}
              inputProps={{
                type: "url",
                disabled: props.disabled,
                placeholder: "https://…",
              }}
              commitOnBlur
              onCommit={(image) => change({ image })}
            />
          ) : null}
          {error ? <FieldError role="alert">{error}</FieldError> : null}
        </FieldGroup>
      )}
    </ValueFrame>
  );
}

function EffectField(
  props: ValueProps & { readonly property: EffectProperty },
) {
  const values = effectValues(props.property, props.value);
  const change = (patch: Record<string, string>) =>
    props.onCommit(buildEffect(props.property, { ...values, ...patch }));
  const keys =
    props.property === "transform"
      ? ["x", "y", "rotate", "scale"]
      : props.property === "boxShadow"
        ? ["x", "y", "blur", "spread"]
        : props.property === "filter"
          ? ["blur", "brightness", "grayscale"]
          : ["blur", "brightness"];
  const names: Record<string, string> = {
    x: "X offset",
    y: "Y offset",
    rotate: "Rotate degrees",
    scale: "Scale",
    blur: "Blur",
    spread: "Spread",
    brightness: "Brightness",
    grayscale: "Grayscale",
  };
  return (
    <ValueFrame {...props} footer={props.children}>
      {() =>
        !props.value ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.disabled}
            onClick={() => change({})}
          >
            Add {props.label.toLowerCase()}
          </Button>
        ) : (
          <FieldGroup className="gap-3">
            <div className="grid grid-cols-2 gap-3">
              {keys.map((key) => (
                <ValidatedInputField
                  key={key}
                  label={`${props.label} ${names[key]}`}
                  value={values[key]!}
                  inputProps={{
                    disabled: props.disabled,
                    type: "number",
                    step: "any",
                    min: ["blur", "scale", "brightness", "grayscale"].includes(
                      key,
                    )
                      ? 0
                      : undefined,
                    max: key === "grayscale" ? 100 : undefined,
                  }}
                  commitOnBlur
                  onCommit={(value) => change({ [key]: value })}
                />
              ))}
            </div>
            {props.property === "boxShadow" ? (
              <ColorField
                label="Shadow colour"
                value={values.color!}
                disabled={props.disabled}
                onCommit={(color) => change({ color })}
              />
            ) : null}
          </FieldGroup>
        )
      }
    </ValueFrame>
  );
}
