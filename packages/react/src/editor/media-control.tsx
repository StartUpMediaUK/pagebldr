"use client";
import { useState } from "react";
import { ArrowUpIcon, ArrowDownIcon, Trash2Icon } from "lucide-react";
import {
  createId,
  resolveMediaVideoEmbed,
  resourceKey,
  type MediaItem,
  type MediaKind,
  type PageElement,
  type ElementControl,
  type ResourceReference,
} from "@pagebldr/core";
import { Button } from "../components/ui/button.js";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "../components/ui/field.js";
import { Switch } from "../components/ui/switch.js";
import { InspectorSelect, InspectorSelectOption } from "./inspector-select.js";
import { ValidatedInputField } from "./validated-input-field.js";
import { MediaPicker, MediaViewer } from "./media-picker.js";
import { usePagebldrEditor } from "./context.js";

type MediaControlDefinition = Extract<
  ElementControl<Record<string, unknown>>,
  { kind: "media" }
>;
function sourceReference(value: unknown): ResourceReference | null {
  if (!value || typeof value !== "object" || !("reference" in value))
    return null;
  const reference = value.reference;
  return reference &&
    typeof reference === "object" &&
    "kind" in reference &&
    typeof reference.kind === "string" &&
    "value" in reference
    ? { kind: reference.kind, value: reference.value }
    : null;
}
export function MediaControl({
  element,
  control,
}: {
  readonly element: PageElement;
  readonly control: MediaControlDefinition;
}) {
  const editor = usePagebldrEditor();
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = editor.mode !== "edit" || element.locked;
  const collection = control.usage === "gallery" || control.usage === "logos";
  const value = element.props[control.key];
  const items = Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>[])
    : [];
  const allowed: readonly MediaKind[] =
    control.usage === "gallery"
      ? ["image", "video"]
      : control.usage === "video"
        ? ["video"]
        : ["image"];
  const references = collection
    ? items.flatMap((item) => {
        const reference = sourceReference(item.source);
        return reference ? [reference] : [];
      })
    : [];
  const update = (patch: Readonly<Record<string, unknown>>) =>
    editor.dispatch({ type: "update-props", elementId: element.id, patch });
  const updateItem = (
    index: number,
    patch: Readonly<Record<string, unknown>>,
  ) =>
    update({
      [control.key]: items.map((item, candidate) =>
        candidate === index ? { ...item, ...patch } : item,
      ),
    });
  const move = (index: number, nextIndex: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item) next.splice(nextIndex, 0, item);
    update({ [control.key]: next });
  };
  const commit = (selected: readonly MediaItem[]) => {
    if (collection) {
      const keys = new Set(references.map(resourceKey));
      const added = selected
        .filter((item) => !keys.has(resourceKey(item.reference)))
        .map((item) =>
          control.usage === "logos"
            ? {
                id: createId("logo"),
                name: item.displayName,
                source: { type: "resource", reference: item.reference },
                alt: item.displayName,
              }
            : {
                id: createId("gallery"),
                kind: item.kind,
                source: { type: "resource", reference: item.reference },
                alt: item.kind === "image" ? item.displayName : "",
                altConfirmed: false,
                decorative: false,
                caption: "",
              },
        );
      update({ [control.key]: [...items, ...added].slice(0, 30) });
    } else {
      const item = selected[0];
      if (!item) return;
      update({
        [control.key]: {
          type: "resource",
          reference: item.reference,
          ...(control.usage === "video"
            ? {
                presentation:
                  item.url && resolveMediaVideoEmbed(item.url)
                    ? "embed"
                    : "native",
              }
            : {}),
        },
        ...(element.type === "image"
          ? { alt: item.displayName, altConfirmed: false, decorative: false }
          : element.type === "logo"
            ? { alt: item.displayName }
            : {}),
      });
    }
  };
  const previewSource = async (
    source: unknown,
    kind: MediaKind,
    name: string,
  ) => {
    setError(null);
    try {
      const reference = sourceReference(source);
      let url: string | null = null;
      if (reference)
        url =
          (await editor.builder.resources
            .get(reference.kind)
            ?.resolve(reference.value, {})) ?? null;
      else if (
        source &&
        typeof source === "object" &&
        "url" in source &&
        typeof source.url === "string"
      )
        url = source.url;
      setViewer({
        reference: reference ?? { kind: "external", value: url },
        kind,
        displayName: name,
        url,
        available: !!url,
        source: reference ? "uploaded" : "external",
        createdAt: "",
      });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Media unavailable.",
      );
    }
  };
  return (
    <FieldSet>
      <FieldLegend>{control.label}</FieldLegend>
      <FieldGroup>
        {!collection ? (
          <FieldDescription>
            {sourceReference(value)
              ? `Resource: ${resourceKey(sourceReference(value)!)}`
              : value && typeof value === "object" && "url" in value
                ? String(value.url)
                : "No media selected."}
          </FieldDescription>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={disabled || (collection && items.length >= 30)}
            onClick={() => setOpen(true)}
          >
            {collection ? "Add media" : "Choose media"}
          </Button>
          {!collection && value ? (
            <Button
              variant="outline"
              onClick={() =>
                void previewSource(value, allowed[0]!, control.label)
              }
            >
              Preview media
            </Button>
          ) : null}
          {control.nullable && value ? (
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() => update({ [control.key]: null })}
            >
              Clear media
            </Button>
          ) : null}
        </div>
        {control.usage === "video" && sourceReference(value) ? (
          <Field>
            <FieldLabel>Managed video presentation</FieldLabel>
            <InspectorSelect
              aria-label="Managed video presentation"
              value={
                value && typeof value === "object" && "presentation" in value
                  ? String(value.presentation)
                  : "native"
              }
              disabled={disabled}
              onChange={(event) =>
                update({
                  [control.key]: {
                    ...(value as object),
                    presentation: event.currentTarget.value,
                  },
                })
              }
            >
              <InspectorSelectOption value="native">
                Native
              </InspectorSelectOption>
              <InspectorSelectOption value="embed">Embed</InspectorSelectOption>
            </InspectorSelect>
          </Field>
        ) : null}
        {collection
          ? items.map((item, index) => (
              <FieldSet key={String(item.id)} className="pb-media-usage">
                <FieldLegend>
                  {control.usage === "logos"
                    ? `Logo ${index + 1}`
                    : `Media ${index + 1} · ${String(item.kind)}`}
                </FieldLegend>
                <FieldGroup>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void previewSource(
                          item.source,
                          item.kind === "video" ? "video" : "image",
                          typeof item.name === "string"
                            ? item.name
                            : typeof item.caption === "string"
                              ? item.caption
                              : `Media ${index + 1}`,
                        )
                      }
                    >
                      Preview
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move media ${index + 1} up`}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUpIcon data-icon="inline-start" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move media ${index + 1} down`}
                      disabled={disabled || index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDownIcon data-icon="inline-start" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove media ${index + 1}`}
                      disabled={disabled || items.length <= 1}
                      onClick={() =>
                        update({
                          [control.key]: items.filter(
                            (_, candidate) => candidate !== index,
                          ),
                        })
                      }
                    >
                      <Trash2Icon data-icon="inline-start" />
                    </Button>
                  </div>
                  {control.usage === "logos" ? (
                    <ValidatedInputField
                      label="Logo name"
                      value={typeof item.name === "string" ? item.name : ""}
                      inputProps={{ disabled }}
                      commitOnBlur
                      onCommit={(name) => updateItem(index, { name })}
                    />
                  ) : (
                    <ValidatedInputField
                      label="Caption"
                      value={
                        typeof item.caption === "string" ? item.caption : ""
                      }
                      inputProps={{ disabled }}
                      commitOnBlur
                      onCommit={(caption) => updateItem(index, { caption })}
                    />
                  )}
                  {item.kind !== "video" ? (
                    <>
                      <ValidatedInputField
                        label="Alternative text"
                        value={typeof item.alt === "string" ? item.alt : ""}
                        inputProps={{ disabled }}
                        commitOnBlur
                        onCommit={(alt) =>
                          updateItem(index, {
                            alt,
                            ...(control.usage === "gallery"
                              ? { altConfirmed: false }
                              : {}),
                          })
                        }
                      />
                      {control.usage === "gallery" ? (
                        <>
                          <Field orientation="horizontal">
                            <FieldLabel
                              htmlFor={`confirmed-${String(item.id)}`}
                            >
                              Alternative text confirmed
                            </FieldLabel>
                            <Switch
                              id={`confirmed-${String(item.id)}`}
                              disabled={disabled}
                              checked={item.altConfirmed === true}
                              onCheckedChange={(altConfirmed) =>
                                updateItem(index, { altConfirmed })
                              }
                            />
                          </Field>
                          <Field orientation="horizontal">
                            <FieldLabel
                              htmlFor={`decorative-${String(item.id)}`}
                            >
                              Decorative
                            </FieldLabel>
                            <Switch
                              id={`decorative-${String(item.id)}`}
                              disabled={disabled}
                              checked={item.decorative === true}
                              onCheckedChange={(decorative) =>
                                updateItem(index, { decorative })
                              }
                            />
                          </Field>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            ))
          : null}
        {error ? <p role="alert">{error}</p> : null}
      </FieldGroup>
      <MediaPicker
        existing={
          !collection && sourceReference(value) ? [sourceReference(value)!] : []
        }
        open={open}
        onOpenChange={setOpen}
        label={control.label}
        allowed={allowed}
        maximum={collection ? 30 - items.length : 1}
        excluded={references}
        onCommit={commit}
      />
      <MediaViewer item={viewer} onClose={() => setViewer(null)} />
    </FieldSet>
  );
}
