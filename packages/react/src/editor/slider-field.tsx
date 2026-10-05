"use client";

import { useId, useState, type ReactNode } from "react";
import { Field, FieldError, FieldLabel } from "../components/ui/field.js";
import { Slider } from "../components/ui/slider.js";
import { commitInputDraft } from "./validated-input-field.js";

export function SliderField({
  value,
  label,
  min,
  max,
  step,
  unit = "",
  disabled,
  onCommit,
  children,
}: {
  readonly value: number;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled: boolean;
  readonly onCommit: (value: number) => void;
  readonly children?: ReactNode;
}) {
  const id = useId();
  const [rejection, setRejection] = useState<{
    source: number;
    message: string | null;
  }>({ source: value, message: null });
  if (rejection.source !== value)
    setRejection({ source: value, message: null });
  const error = rejection.source === value ? rejection.message : null;
  return (
    <Field
      data-invalid={Boolean(error) || undefined}
      data-disabled={disabled || undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <FieldLabel id={id}>{label}</FieldLabel>
        <span className="text-xs text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        aria-valuetext={`${value}${unit}`}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled}
        min={min}
        max={max}
        step={step ?? 1}
        value={[value]}
        onValueChange={([next]) => {
          if (next === undefined || next === value) return;
          const message = commitInputDraft(String(next), () => onCommit(next));
          setRejection({ source: value, message });
        }}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      {children}
    </Field>
  );
}
