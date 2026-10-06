"use client";

import Color from "color";
import { useId, useState, type ReactNode, type PointerEvent } from "react";
import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { Slider } from "../components/ui/slider.js";
import {
  ValidatedInputField,
  commitInputDraft,
} from "./validated-input-field.js";
import { changedColor, selectionColor } from "./color-value.js";

export function ColorField({
  value,
  label,
  disabled,
  allowAlpha = true,
  resolvedValue,
  onCommit,
  labelAction,
  children,
  encoding = "css",
}: {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly allowAlpha?: boolean;
  readonly resolvedValue?: string;
  readonly onCommit: (value: string) => void;
  readonly labelAction?: ReactNode;
  readonly children?: ReactNode;
  readonly encoding?: "css" | "hex";
}) {
  const id = useId();
  const commit = (draft: string) => {
    if (disabled) return;
    if (draft === "") {
      if (value !== "") onCommit("");
      return;
    }
    const next = changedColor(value, draft, allowAlpha);
    if (next !== null)
      onCommit(
        encoding === "hex" && Color(next).alpha() < 1
          ? Color(next).hexa()
          : next,
      );
  };
  let displayed: string;
  try {
    displayed = Color(value || resolvedValue || "transparent").hexa();
  } catch {
    displayed = "#00000000";
  }
  return (
    <ValidatedInputField
      label={label}
      value={value}
      onCommit={commit}
      inputProps={{ disabled, placeholder: resolvedValue }}
      labelAction={labelAction}
      inputLeading={
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={`Choose ${label.toLowerCase()} colour`}
            >
              <span aria-hidden="true" className="pagebldr-color-swatch">
                <span style={{ backgroundColor: displayed }} />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64"
            aria-labelledby={`${id}-title`}
          >
            <h2 id={`${id}-title`} className="sr-only">
              {label} colour
            </h2>
            <ColorPanel
              value={displayed}
              allowAlpha={allowAlpha}
              disabled={disabled}
              onCommit={commit}
            />
          </PopoverContent>
        </Popover>
      }
    >
      {children}
    </ValidatedInputField>
  );
}

function colorSelection(value: string) {
  const color = Color(value);
  return {
    source: value,
    hue: color.hue(),
    saturation: color.saturationl(),
    brightness:
      (color.lightness() /
        (color.saturationl() < 1 ? 100 : 100 - color.saturationl() / 2)) *
      100,
    alpha: color.alpha(),
  };
}

function ColorPanel({
  value,
  allowAlpha,
  disabled,
  onCommit,
}: {
  readonly value: string;
  readonly allowAlpha: boolean;
  readonly disabled: boolean;
  readonly onCommit: (value: string) => void;
}) {
  const id = useId();
  const [selection, setSelection] = useState(() => colorSelection(value));
  const [format, setFormat] = useState("hex");
  const [error, setError] = useState<string | null>(null);
  // Controlled updates/Undo synchronize the panel but never emit a command.
  if (selection.source !== value) setSelection(colorSelection(value));
  const current =
    selection.source === value ? selection : colorSelection(value);
  const update = (patch: Partial<typeof selection>) => {
    const next = { ...current, ...patch };
    const colour = selectionColor(
      next.hue,
      next.saturation / 100,
      1 - next.brightness / 100,
      allowAlpha ? next.alpha : 1,
    );
    const message = commitInputDraft(colour, onCommit);
    setError(message);
    if (!message) setSelection({ ...next, source: Color(colour).hexa() });
  };
  const pointer = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    update({
      saturation: Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      brightness: Math.max(
        0,
        Math.min(100, 100 - ((event.clientY - rect.top) / rect.height) * 100),
      ),
    });
  };
  const color = Color(value);
  const formatted =
    format === "rgb"
      ? color.rgb().string()
      : format === "hsl"
        ? color.hsl().string()
        : allowAlpha && color.alpha() < 1
          ? color.hexa()
          : color.hex();
  return (
    <FieldGroup className="gap-3">
      <Field>
        <button
          type="button"
          disabled={disabled}
          className="pagebldr-color-selection"
          aria-label="Colour saturation and brightness"
          aria-describedby={`${id}-instructions`}
          style={{ backgroundColor: `hsl(${current.hue} 100% 50%)` }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              pointer(event);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 1;
            const patch =
              event.key === "ArrowRight"
                ? { saturation: Math.min(100, current.saturation + step) }
                : event.key === "ArrowLeft"
                  ? { saturation: Math.max(0, current.saturation - step) }
                  : event.key === "ArrowUp"
                    ? { brightness: Math.min(100, current.brightness + step) }
                    : event.key === "ArrowDown"
                      ? { brightness: Math.max(0, current.brightness - step) }
                      : null;
            if (patch) {
              event.preventDefault();
              update(patch);
            }
          }}
        >
          <span
            className="pagebldr-color-selection-thumb"
            style={{
              left: `${current.saturation}%`,
              top: `${100 - current.brightness}%`,
            }}
          />
        </button>
        <p id={`${id}-instructions`} className="sr-only">
          Left and right adjust saturation; up and down adjust brightness. Hold
          Shift for larger steps.
        </p>
        <span className="sr-only" role="status">
          Saturation {Math.round(current.saturation)}%, brightness{" "}
          {Math.round(current.brightness)}%
        </span>
      </Field>
      <Field>
        <FieldLabel className="sr-only" id={`${id}-hue`}>
          Hue
        </FieldLabel>
        <Slider
          aria-labelledby={`${id}-hue`}
          aria-valuetext={`${Math.round(current.hue)} degrees`}
          disabled={disabled}
          className="pagebldr-color-hue"
          min={0}
          max={360}
          value={[current.hue]}
          onValueChange={([hue]) => {
            if (hue !== undefined) update({ hue });
          }}
        />
      </Field>
      {allowAlpha ? (
        <Field>
          <FieldLabel className="sr-only" id={`${id}-alpha`}>
            Opacity
          </FieldLabel>
          <Slider
            aria-labelledby={`${id}-alpha`}
            aria-valuetext={`${Math.round(current.alpha * 100)}%`}
            disabled={disabled}
            min={0}
            max={100}
            value={[current.alpha * 100]}
            onValueChange={([alpha]) => {
              if (alpha !== undefined) update({ alpha: alpha / 100 });
            }}
          />
        </Field>
      ) : null}
      <Field>
        <FieldLabel className="sr-only" htmlFor={`${id}-format`}>
          Colour format
        </FieldLabel>
        <NativeSelect
          disabled={disabled}
          id={`${id}-format`}
          value={format}
          onChange={(event) => setFormat(event.currentTarget.value)}
        >
          <NativeSelectOption value="hex">HEX</NativeSelectOption>
          <NativeSelectOption value="rgb">RGB</NativeSelectOption>
          <NativeSelectOption value="hsl">HSL</NativeSelectOption>
        </NativeSelect>
      </Field>
      <ValidatedInputField
        label="Colour value"
        value={formatted}
        inputProps={{ disabled }}
        onCommit={onCommit}
      />
      {error ? <FieldError role="alert">{error}</FieldError> : null}
    </FieldGroup>
  );
}
