"use client";

import { useId } from "react";

import {
  resourceKey,
  type Destination,
  type PageDocument,
} from "@pagebldr/core";
import type { ApplicationDestinationOption } from "./context.js";
import { Field, FieldDescription, FieldLabel } from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { Switch } from "../components/ui/switch.js";

interface DestinationControlDefinition {
  readonly label: string;
  readonly description?: string;
  readonly nullable?: boolean;
}

interface AnchoredElement {
  readonly id: string;
  readonly anchorId: string;
  readonly name: string;
}

export function anchoredElements(document: PageDocument): AnchoredElement[] {
  return Object.values(document.elements).flatMap((element) => {
    const anchorId = element.props.anchorId;
    return typeof anchorId === "string" && anchorId.length > 0
      ? [{ id: element.id, anchorId, name: element.name }]
      : [];
  });
}

export function destinationForType(
  type: Destination["type"],
  anchors: readonly AnchoredElement[],
  applications: readonly ApplicationDestinationOption[],
): Destination | null {
  if (type === "external")
    return { type, url: "https://example.com", newTab: false };
  if (type === "anchor")
    return anchors[0] ? { type, elementId: anchors[0].id } : null;
  if (type === "email") return { type, address: "hello@example.com" };
  if (type === "telephone") return { type, number: "+44 20 1234 5678" };
  return applications[0]
    ? { type, reference: applications[0].reference, newTab: false }
    : null;
}

export function DestinationControl({
  applicationDestinations,
  control,
  disabled,
  document,
  elementId,
  onChange,
  value,
}: {
  readonly applicationDestinations: readonly ApplicationDestinationOption[];
  readonly control: DestinationControlDefinition;
  readonly disabled: boolean;
  readonly document: PageDocument;
  readonly elementId: string;
  readonly onChange: (value: Destination | null) => void;
  readonly value: unknown;
}) {
  const id = useId();
  const destination = readDestination(value);
  const anchors = anchoredElements(document);
  const currentType =
    destination?.type ?? (control.nullable ? "none" : "external");
  const updateType = (type: string) => {
    if (type === "none") return onChange(null);
    const next = destinationForType(
      type as Destination["type"],
      anchors,
      applicationDestinations,
    );
    if (next) onChange(next);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-3">
      <Field>
        <FieldLabel htmlFor={`${id}-type`}>{control.label} type</FieldLabel>
        <NativeSelect
          id={`${id}-type`}
          value={currentType}
          disabled={disabled}
          onChange={(event) => updateType(event.currentTarget.value)}
        >
          {control.nullable ? (
            <NativeSelectOption value="none">No destination</NativeSelectOption>
          ) : null}
          <NativeSelectOption value="external">External URL</NativeSelectOption>
          <NativeSelectOption value="anchor" disabled={anchors.length === 0}>
            Anchor
          </NativeSelectOption>
          <NativeSelectOption value="email">Email</NativeSelectOption>
          <NativeSelectOption value="telephone">Telephone</NativeSelectOption>
          <NativeSelectOption
            value="application"
            disabled={applicationDestinations.length === 0}
          >
            Application page
          </NativeSelectOption>
        </NativeSelect>
        {control.description ? (
          <FieldDescription>{control.description}</FieldDescription>
        ) : null}
      </Field>
      {destination?.type === "external" ? (
        <ExternalDestination
          destination={destination}
          disabled={disabled}
          id={id}
          elementId={elementId}
          onChange={onChange}
        />
      ) : null}
      {destination?.type === "anchor" ? (
        <AnchorDestination
          anchors={anchors}
          destination={destination}
          disabled={disabled}
          document={document}
          id={id}
          onChange={onChange}
        />
      ) : null}
      {destination?.type === "email" ? (
        <EmailDestination
          destination={destination}
          disabled={disabled}
          id={id}
          elementId={elementId}
          onChange={onChange}
        />
      ) : null}
      {destination?.type === "telephone" ? (
        <TelephoneDestination
          destination={destination}
          disabled={disabled}
          id={id}
          elementId={elementId}
          onChange={onChange}
        />
      ) : null}
      {destination?.type === "application" ? (
        <ApplicationDestination
          destination={destination}
          disabled={disabled}
          id={id}
          options={applicationDestinations}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

function ExternalDestination({
  destination,
  disabled,
  elementId,
  id,
  onChange,
}: {
  readonly destination: Extract<Destination, { type: "external" }>;
  readonly disabled: boolean;
  readonly elementId: string;
  readonly id: string;
  readonly onChange: (value: Destination) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-url`}>URL</FieldLabel>
        <Input
          key={`url:${elementId}:${destination.url}`}
          id={`${id}-url`}
          type="url"
          defaultValue={destination.url}
          disabled={disabled}
          onBlur={(event) => {
            const url = event.currentTarget.value.trim();
            if (isHttpUrl(url)) onChange({ ...destination, url });
            else event.currentTarget.value = destination.url;
          }}
        />
      </Field>
      <BooleanField
        id={`${id}-new-tab`}
        label="Open in new tab"
        checked={destination.newTab}
        disabled={disabled}
        onChange={(newTab) => onChange({ ...destination, newTab })}
      />
    </>
  );
}

function AnchorDestination({
  anchors,
  destination,
  disabled,
  document,
  id,
  onChange,
}: {
  readonly anchors: readonly AnchoredElement[];
  readonly destination: Extract<Destination, { type: "anchor" }>;
  readonly disabled: boolean;
  readonly document: PageDocument;
  readonly id: string;
  readonly onChange: (value: Destination) => void;
}) {
  const currentIsAddressable = anchors.some(
    ({ id }) => id === destination.elementId,
  );
  return (
    <Field>
      <FieldLabel htmlFor={`${id}-anchor`}>Anchor</FieldLabel>
      <NativeSelect
        id={`${id}-anchor`}
        value={destination.elementId}
        disabled={disabled}
        onChange={(event) =>
          onChange({ type: "anchor", elementId: event.currentTarget.value })
        }
      >
        {!currentIsAddressable ? (
          <NativeSelectOption value={destination.elementId} disabled>
            Broken target —{" "}
            {document.elements[destination.elementId]?.name ??
              destination.elementId}
          </NativeSelectOption>
        ) : null}
        {anchors.map((anchor) => (
          <NativeSelectOption key={anchor.id} value={anchor.id}>
            {anchor.anchorId} — {anchor.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function EmailDestination({
  destination,
  disabled,
  elementId,
  id,
  onChange,
}: {
  readonly destination: Extract<Destination, { type: "email" }>;
  readonly disabled: boolean;
  readonly elementId: string;
  readonly id: string;
  readonly onChange: (value: Destination) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-email`}>Email address</FieldLabel>
        <Input
          key={`email:${elementId}:${destination.address}`}
          id={`${id}-email`}
          type="email"
          defaultValue={destination.address}
          disabled={disabled}
          onBlur={(event) => {
            const address = event.currentTarget.value.trim();
            if (isEmail(address)) onChange({ ...destination, address });
            else event.currentTarget.value = destination.address;
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-subject`}>Subject</FieldLabel>
        <Input
          id={`${id}-subject`}
          value={destination.subject ?? ""}
          maxLength={300}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...destination,
              subject: event.currentTarget.value || undefined,
            })
          }
        />
      </Field>
    </>
  );
}

function TelephoneDestination({
  destination,
  disabled,
  elementId,
  id,
  onChange,
}: {
  readonly destination: Extract<Destination, { type: "telephone" }>;
  readonly disabled: boolean;
  readonly elementId: string;
  readonly id: string;
  readonly onChange: (value: Destination) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`${id}-telephone`}>Telephone</FieldLabel>
      <Input
        key={`telephone:${elementId}:${destination.number}`}
        id={`${id}-telephone`}
        type="tel"
        defaultValue={destination.number}
        disabled={disabled}
        onBlur={(event) => {
          const number = event.currentTarget.value.trim();
          if (/^\+?[0-9 ().-]{3,40}$/u.test(number))
            onChange({ type: "telephone", number });
          else event.currentTarget.value = destination.number;
        }}
      />
    </Field>
  );
}

function ApplicationDestination({
  destination,
  disabled,
  id,
  onChange,
  options,
}: {
  readonly destination: Extract<Destination, { type: "application" }>;
  readonly disabled: boolean;
  readonly id: string;
  readonly onChange: (value: Destination) => void;
  readonly options: readonly ApplicationDestinationOption[];
}) {
  const current = resourceKey(destination.reference);
  const known = options.some(
    ({ reference }) => resourceKey(reference) === current,
  );
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-application`}>Application page</FieldLabel>
        <NativeSelect
          id={`${id}-application`}
          value={current}
          disabled={disabled || options.length === 0}
          onChange={(event) => {
            const option = options.find(
              ({ reference }) =>
                resourceKey(reference) === event.currentTarget.value,
            );
            if (option)
              onChange({ ...destination, reference: option.reference });
          }}
        >
          {!known ? (
            <NativeSelectOption value={current} disabled>
              Unavailable application page
            </NativeSelectOption>
          ) : null}
          {options.map((option) => (
            <NativeSelectOption
              key={resourceKey(option.reference)}
              value={resourceKey(option.reference)}
            >
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {options.find(({ reference }) => resourceKey(reference) === current)
          ?.description ? (
          <FieldDescription>
            {
              options.find(
                ({ reference }) => resourceKey(reference) === current,
              )?.description
            }
          </FieldDescription>
        ) : null}
      </Field>
      <BooleanField
        id={`${id}-application-new-tab`}
        label="Open in new tab"
        checked={destination.newTab ?? false}
        disabled={disabled}
        onChange={(newTab) => onChange({ ...destination, newTab })}
      />
    </>
  );
}

function BooleanField({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </Field>
  );
}

function readDestination(value: unknown): Destination | null {
  if (!value || typeof value !== "object" || !("type" in value)) return null;
  return value as Destination;
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) && value.length <= 320;
}
