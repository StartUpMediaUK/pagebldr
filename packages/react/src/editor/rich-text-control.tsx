"use client";

import { useId } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type { ElementControl } from "@pagebldr/core";
import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { ValidatedInputField } from "./validated-input-field.js";
import { moveCollectionItem } from "./collection-control.js";

type RichTextControlDefinition = Extract<
  ElementControl<Record<string, unknown>>,
  { readonly kind: "rich-text" }
>;

type RichTextBlock = Readonly<Record<string, unknown>>;

export function createRichTextBlock(
  control: RichTextControlDefinition,
): RichTextBlock {
  return structuredClone(control.defaultBlock);
}

export function RichTextControl({
  control,
  disabled,
  onChange,
  value,
}: {
  readonly control: RichTextControlDefinition;
  readonly disabled: boolean;
  readonly onChange: (value: readonly RichTextBlock[]) => void;
  readonly value: unknown;
}) {
  const id = useId();
  const blocks = Array.isArray(value)
    ? (value as readonly RichTextBlock[])
    : [];
  const atMinimum = blocks.length <= (control.minBlocks ?? 0);
  const atMaximum =
    blocks.length >= (control.maxBlocks ?? Number.POSITIVE_INFINITY);
  const updateBlock = (index: number, patch: RichTextBlock) => {
    if (
      Object.entries(patch).every(([key, next]) =>
        Object.is(blocks[index]?.[key], next),
      )
    )
      return;
    onChange(
      blocks.map((block, candidateIndex) =>
        candidateIndex === index ? { ...block, ...patch } : block,
      ),
    );
  };

  return (
    <FieldSet className="gap-4">
      <FieldLegend variant="label">{control.label}</FieldLegend>
      <FieldGroup className="gap-4">
        {blocks.map((block, index) => {
          const type = typeof block.type === "string" ? block.type : "";
          const text = typeof block.text === "string" ? block.text : "";
          const selectedType = control.blockTypes.find(
            ({ value: candidate }) => candidate === type,
          );
          return (
            <FieldSet className="gap-3 rounded-lg border p-3" key={index}>
              <div className="flex items-center justify-between gap-2">
                <FieldLegend className="m-0" variant="label">
                  Block {index + 1}
                </FieldLegend>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label={`Move block ${index + 1} up`}
                    disabled={disabled || index === 0}
                    onClick={() =>
                      onChange(moveCollectionItem(blocks, index, index - 1))
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    aria-label={`Move block ${index + 1} down`}
                    disabled={disabled || index === blocks.length - 1}
                    onClick={() =>
                      onChange(moveCollectionItem(blocks, index, index + 1))
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    aria-label={`Remove block ${index + 1}`}
                    disabled={disabled || atMinimum}
                    onClick={() =>
                      onChange(
                        blocks.filter(
                          (_, candidateIndex) => candidateIndex !== index,
                        ),
                      )
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              <Field>
                <FieldLabel htmlFor={`${id}-${index}-type`}>Type</FieldLabel>
                <NativeSelect
                  disabled={disabled}
                  id={`${id}-${index}-type`}
                  value={selectedType?.value ?? ""}
                  onChange={(event) =>
                    updateBlock(index, { type: event.currentTarget.value })
                  }
                >
                  {!selectedType ? (
                    <NativeSelectOption value="" disabled>
                      Select block type
                    </NativeSelectOption>
                  ) : null}
                  {control.blockTypes.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <ValidatedInputField
                label="Text"
                multiline
                inputProps={{ disabled }}
                value={text}
                onCommit={(text) => updateBlock(index, { text })}
              />
            </FieldSet>
          );
        })}
      </FieldGroup>
      <Button
        disabled={disabled || atMaximum}
        onClick={() => onChange([...blocks, createRichTextBlock(control)])}
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon data-icon="inline-start" /> Add block
      </Button>
    </FieldSet>
  );
}
