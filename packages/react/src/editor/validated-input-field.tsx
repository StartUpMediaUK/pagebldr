"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { PagebldrError } from "@pagebldr/core";

import { Field, FieldError, FieldLabel } from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";

type InputOptions = Omit<
  ComponentProps<typeof Input>,
  "id" | "value" | "defaultValue" | "onChange" | "onKeyDown"
>;

/** Drafts never enter the Document until the command accepts them. */
export function ValidatedInputField({
  value,
  label,
  onCommit,
  inputProps,
  labelAction,
  children,
}: {
  readonly value: string;
  readonly label: string;
  readonly onCommit: (draft: string) => void;
  readonly inputProps?: InputOptions;
  readonly labelAction?: ReactNode;
  readonly children?: ReactNode;
}) {
  const id = useId();
  const [draft, setDraft] = useState<{
    source: string;
    value: string;
    error: string | null;
  }>({
    source: value,
    value,
    error: null,
  });
  // Undo, reset and controlled Host updates replace any stale draft.
  if (draft.source !== value) setDraft({ source: value, value, error: null });
  const current = draft.source === value ? draft : { value, error: null };
  const errorId = `${id}-error`;

  return (
    <Field
      data-invalid={Boolean(current.error) || undefined}
      data-disabled={inputProps?.disabled || undefined}
    >
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={id} className="flex-1">
          {label}
        </FieldLabel>
        {labelAction}
      </div>
      <Input
        {...inputProps}
        id={id}
        value={current.value}
        aria-invalid={Boolean(current.error) || undefined}
        aria-describedby={current.error ? errorId : undefined}
        onChange={(event) => {
          const next = event.currentTarget.value;
          const error =
            next === value ? null : commitInputDraft(next, onCommit);
          setDraft({ source: value, value: next, error });
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && current.error) {
            event.preventDefault();
            event.stopPropagation();
            setDraft({ source: value, value, error: null });
          }
        }}
      />
      {current.error ? (
        <FieldError id={errorId}>{current.error}</FieldError>
      ) : null}
      {children}
    </Field>
  );
}

export function commitInputDraft(
  draft: string,
  commit: (draft: string) => void,
): string | null {
  try {
    commit(draft);
    return null;
  } catch (error) {
    if (
      error instanceof PagebldrError &&
      Array.isArray(error.details?.issues)
    ) {
      const messages = error.details.issues.flatMap((issue: unknown) =>
        issue &&
        typeof issue === "object" &&
        "message" in issue &&
        typeof issue.message === "string"
          ? [issue.message]
          : [],
      );
      if (messages.length) return [...new Set(messages)].join(" ");
    }
    return error instanceof Error
      ? error.message
      : "This value could not be applied.";
  }
}

export function parseNumberDraft(
  draft: string,
  min?: number,
  max?: number,
): number {
  const value = Number(draft);
  if (!draft.trim() || !Number.isFinite(value))
    throw new Error("Enter a number.");
  if (min !== undefined && value < min)
    throw new Error(`Enter a value of ${min} or more.`);
  if (max !== undefined && value > max)
    throw new Error(`Enter a value of ${max} or less.`);
  return value;
}
