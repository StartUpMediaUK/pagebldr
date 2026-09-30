"use client";

import { useId } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  createId,
  type Destination,
  type ElementControl,
  type IdFactory,
  type PageDocument,
} from "@pagebldr/core";
import type { ApplicationDestinationOption } from "./context.js";
import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { Textarea } from "../components/ui/textarea.js";
import { anchoredElements, DestinationControl } from "./destination-control.js";

type CollectionControlDefinition = Extract<
  ElementControl<Record<string, unknown>>,
  { readonly kind: "collection" }
>;

type CollectionItem = Readonly<Record<string, unknown>>;

export function moveCollectionItem(
  items: readonly CollectionItem[],
  index: number,
  nextIndex: number,
): CollectionItem[] {
  if (
    index === nextIndex ||
    index < 0 ||
    nextIndex < 0 ||
    index >= items.length ||
    nextIndex >= items.length
  )
    return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item) next.splice(nextIndex, 0, item);
  return next;
}

export function createCollectionItem(
  control: CollectionControlDefinition,
  document: PageDocument,
  idFactory: IdFactory = createId,
): CollectionItem {
  const item: Record<string, unknown> = {
    ...control.defaultItem,
    [control.idKey]: idFactory(control.idPrefix),
  };
  const anchor = anchoredElements(document)[0];
  for (const itemControl of control.itemControls) {
    if (
      itemControl.kind === "destination" &&
      itemControl.preferFirstAnchor &&
      anchor
    )
      item[itemControl.key] = {
        type: "anchor",
        elementId: anchor.id,
      } satisfies Destination;
  }
  return item;
}

export function CollectionControl({
  applicationDestinations,
  control,
  disabled,
  document,
  elementId,
  onChange,
  value,
}: {
  readonly applicationDestinations: readonly ApplicationDestinationOption[];
  readonly control: CollectionControlDefinition;
  readonly disabled: boolean;
  readonly document: PageDocument;
  readonly elementId: string;
  readonly onChange: (value: readonly CollectionItem[]) => void;
  readonly value: unknown;
}) {
  const id = useId();
  const items = Array.isArray(value)
    ? (value as readonly CollectionItem[])
    : [];
  const atMinimum = items.length <= (control.minItems ?? 0);
  const atMaximum =
    items.length >= (control.maxItems ?? Number.POSITIVE_INFINITY);
  const updateItem = (index: number, key: string, nextValue: unknown) =>
    onChange(
      items.map((item, candidateIndex) =>
        candidateIndex === index ? { ...item, [key]: nextValue } : item,
      ),
    );

  return (
    <FieldSet className="gap-4">
      <FieldLegend variant="label">{control.label}</FieldLegend>
      <FieldGroup className="gap-4">
        {items.map((item, index) => {
          const rawItemId = item[control.idKey];
          const itemId =
            typeof rawItemId === "string" || typeof rawItemId === "number"
              ? String(rawItemId)
              : String(index);
          return (
            <FieldSet className="gap-3 rounded-lg border p-3" key={itemId}>
              <div className="flex items-center justify-between gap-2">
                <FieldLegend className="m-0" variant="label">
                  {control.itemLabel} {index + 1}
                </FieldLegend>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label={`Move ${control.itemLabel.toLowerCase()} ${index + 1} up`}
                    disabled={disabled || index === 0}
                    onClick={() =>
                      onChange(moveCollectionItem(items, index, index - 1))
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    aria-label={`Move ${control.itemLabel.toLowerCase()} ${index + 1} down`}
                    disabled={disabled || index === items.length - 1}
                    onClick={() =>
                      onChange(moveCollectionItem(items, index, index + 1))
                    }
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    aria-label={`Remove ${control.itemLabel.toLowerCase()} ${index + 1}`}
                    disabled={disabled || atMinimum}
                    onClick={() =>
                      onChange(
                        items.filter(
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
              {control.itemControls.map((itemControl) => {
                const itemValue = item[itemControl.key];
                if (itemControl.kind === "destination")
                  return (
                    <DestinationControl
                      applicationDestinations={applicationDestinations}
                      control={itemControl}
                      disabled={disabled}
                      document={document}
                      elementId={`${elementId}:${itemId}`}
                      key={itemControl.key}
                      value={itemValue}
                      onChange={(nextValue) =>
                        updateItem(index, itemControl.key, nextValue)
                      }
                    />
                  );
                if (itemControl.kind === "select") {
                  const selected = itemControl.options.find(
                    ({ value: option }) => option === itemValue,
                  );
                  return (
                    <Field key={itemControl.key}>
                      <FieldLabel
                        htmlFor={`${id}-${itemId}-${itemControl.key}`}
                      >
                        {itemControl.label}
                      </FieldLabel>
                      <NativeSelect
                        disabled={disabled}
                        id={`${id}-${itemId}-${itemControl.key}`}
                        value={selected ? String(selected.value) : ""}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          const option = itemControl.options.find(
                            ({ value: candidate }) =>
                              String(candidate) === nextValue,
                          );
                          if (option)
                            updateItem(index, itemControl.key, option.value);
                        }}
                      >
                        {!selected ? (
                          <NativeSelectOption value="" disabled>
                            Select {itemControl.label.toLowerCase()}
                          </NativeSelectOption>
                        ) : null}
                        {itemControl.options.map((option) => (
                          <NativeSelectOption
                            key={`${typeof option.value}:${option.value}`}
                            value={String(option.value)}
                          >
                            {option.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                  );
                }
                const textValue =
                  typeof itemValue === "string" ? itemValue : "";
                const commitText = (nextValue: string) => {
                  const trimmed = nextValue.trim();
                  if (
                    (trimmed || itemControl.allowEmpty) &&
                    trimmed !== itemValue
                  )
                    updateItem(index, itemControl.key, trimmed);
                  return trimmed || itemControl.allowEmpty
                    ? trimmed
                    : textValue;
                };
                return (
                  <Field key={itemControl.key}>
                    <FieldLabel htmlFor={`${id}-${itemId}-${itemControl.key}`}>
                      {itemControl.label}
                    </FieldLabel>
                    {itemControl.kind === "textarea" ? (
                      <Textarea
                        defaultValue={textValue}
                        disabled={disabled}
                        id={`${id}-${itemId}-${itemControl.key}`}
                        key={`${itemId}:${itemControl.key}:${textValue}`}
                        placeholder={itemControl.placeholder}
                        onBlur={(event) => {
                          event.currentTarget.value = commitText(
                            event.currentTarget.value,
                          );
                        }}
                      />
                    ) : (
                      <Input
                        defaultValue={textValue}
                        disabled={disabled}
                        id={`${id}-${itemId}-${itemControl.key}`}
                        key={`${itemId}:${itemControl.key}:${textValue}`}
                        placeholder={itemControl.placeholder}
                        onBlur={(event) => {
                          event.currentTarget.value = commitText(
                            event.currentTarget.value,
                          );
                        }}
                      />
                    )}
                  </Field>
                );
              })}
            </FieldSet>
          );
        })}
      </FieldGroup>
      <Button
        disabled={disabled || atMaximum}
        onClick={() =>
          onChange([...items, createCollectionItem(control, document)])
        }
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon data-icon="inline-start" /> Add{" "}
        {control.itemLabel.toLowerCase()}
      </Button>
    </FieldSet>
  );
}
