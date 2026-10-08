"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";

import { resourceKey, type PageSettings } from "@pagebldr/core";

import { Button } from "../components/ui/button.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.js";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import { Switch } from "../components/ui/switch.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs.js";
import { Textarea } from "../components/ui/textarea.js";
import { usePagebldrEditor } from "./context.js";
import { VariableManager } from "./variable-manager.js";
import { MediaPicker } from "./media-picker.js";
import {
  ValidatedInputField,
  parseNumberDraft,
} from "./validated-input-field.js";

type PageDesignTab = "design" | "settings" | "seo" | "variables";

export const defaultPageDesign = Object.freeze({
  contentWidth: 1_200,
  tabletMax: 1_024,
  mobileMax: 767,
});

export function validatePageDesign(settings: PageSettings): readonly string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(settings.contentWidth) ||
    settings.contentWidth < 320 ||
    settings.contentWidth > 2_400
  )
    errors.push(
      "Content width must be a whole number from 320 to 2400 pixels.",
    );
  if (
    !Number.isInteger(settings.breakpoints.tabletMax) ||
    settings.breakpoints.tabletMax < 768 ||
    settings.breakpoints.tabletMax > 1_200
  )
    errors.push(
      "Tablet maximum must be a whole number from 768 to 1200 pixels.",
    );
  if (
    !Number.isInteger(settings.breakpoints.mobileMax) ||
    settings.breakpoints.mobileMax < 320 ||
    settings.breakpoints.mobileMax > 767
  )
    errors.push(
      "Mobile maximum must be a whole number from 320 to 767 pixels.",
    );
  if (settings.breakpoints.mobileMax >= settings.breakpoints.tabletMax)
    errors.push("Mobile maximum must be smaller than tablet maximum.");
  return errors;
}

export function validatePageTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "Page title is required.";
  if (trimmed.length > 160)
    return "Page title must use 160 characters or fewer.";
  return null;
}

export function PageDesignDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const editor = usePagebldrEditor();
  const [draft, setDraft] = useState<PageSettings>(editor.document.settings);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PageDesignTab>("design");
  const [pageTitleError, setPageTitleError] = useState<string | null>(null);
  const [designReset, setDesignReset] = useState(0);
  const [invalidFields, setInvalidFields] = useState<
    Readonly<Record<string, boolean>>
  >({});
  const wasOpen = useRef(false);
  const readOnly = editor.mode !== "edit";
  const errors = validatePageDesign(draft);

  useEffect(() => {
    if (!open) setMediaOpen(false);
    if (open && !wasOpen.current) {
      setDraft(structuredClone(editor.document.settings));
      setPageTitleError(null);
      setInvalidFields({});
    }
    wasOpen.current = open;
  }, [editor.document.settings, editor.document.title, open]);

  const update = (patch: Partial<PageSettings>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const updateBreakpoints = (patch: Partial<PageSettings["breakpoints"]>) =>
    setDraft((current) => ({
      ...current,
      breakpoints: { ...current.breakpoints, ...patch },
    }));
  const validity = (field: string, valid: boolean) =>
    setInvalidFields((current) =>
      current[field] === !valid ? current : { ...current, [field]: !valid },
    );
  const updateSeo = (patch: Partial<PageSettings["seo"]>) =>
    setDraft((current) => ({
      ...current,
      seo: { ...current.seo, ...patch },
    }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[min(48rem,calc(100%-2rem))] overflow-hidden p-0 sm:max-w-2xl"
          onEscapeKeyDown={(event) => {
            if (
              event.target instanceof HTMLElement &&
              event.target.matches(
                '[data-draft-changed="true"], [aria-invalid="true"]',
              )
            )
              event.preventDefault();
          }}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Page design</DialogTitle>
            <DialogDescription>
              Edit page-wide layout, Host chrome intent, and search/social
              metadata.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as PageDesignTab)}
            className="min-h-0 gap-0"
          >
            <TabsList className="mx-6 grid w-auto grid-cols-4">
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="seo">SEO &amp; social</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </TabsList>
            <div className="max-h-[32rem] overflow-y-auto px-6 py-5">
              <TabsContent value="design">
                <FieldGroup>
                  <NumberField
                    key={`${designReset}:contentWidth`}
                    label="Content width"
                    value={draft.contentWidth}
                    min={320}
                    max={2_400}
                    disabled={readOnly}
                    onValidityChange={(valid) =>
                      validity("contentWidth", valid)
                    }
                    onChange={(contentWidth) => update({ contentWidth })}
                  />
                  <NumberField
                    key={`${designReset}:tabletMax`}
                    label="Tablet maximum"
                    value={draft.breakpoints.tabletMax}
                    min={768}
                    max={1_200}
                    disabled={readOnly}
                    onValidityChange={(valid) => validity("tabletMax", valid)}
                    onChange={(tabletMax) => updateBreakpoints({ tabletMax })}
                  />
                  <NumberField
                    key={`${designReset}:mobileMax`}
                    label="Mobile maximum"
                    value={draft.breakpoints.mobileMax}
                    min={320}
                    max={767}
                    disabled={readOnly}
                    onValidityChange={(valid) => validity("mobileMax", valid)}
                    onChange={(mobileMax) => updateBreakpoints({ mobileMax })}
                  />
                  {errors.map((error) => (
                    <FieldError key={error}>{error}</FieldError>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={readOnly}
                    onClick={() => {
                      setInvalidFields({});
                      setDesignReset((current) => current + 1);
                      update({ contentWidth: defaultPageDesign.contentWidth });
                      updateBreakpoints({
                        tabletMax: defaultPageDesign.tabletMax,
                        mobileMax: defaultPageDesign.mobileMax,
                      });
                    }}
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Reset design defaults
                  </Button>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="settings">
                <FieldGroup>
                  <Field orientation="horizontal">
                    <div className="flex flex-1 flex-col gap-1">
                      <FieldLabel htmlFor="pb-page-default-header">
                        Show default Host header
                      </FieldLabel>
                      <FieldDescription>
                        Records Host chrome intent; pagebldr does not render the
                        header.
                      </FieldDescription>
                    </div>
                    <Switch
                      id="pb-page-default-header"
                      checked={draft.showDefaultHeader}
                      disabled={readOnly}
                      onCheckedChange={(showDefaultHeader) =>
                        update({ showDefaultHeader })
                      }
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="seo">
                <FieldGroup>
                  <ValidatedInputField
                    label="Page title"
                    value={editor.document.title}
                    inputProps={{ maxLength: 160, disabled: readOnly }}
                    commitOnBlur
                    onValidityChange={(valid) =>
                      setPageTitleError(valid ? null : "Page title is invalid.")
                    }
                    onCommit={(draft) => {
                      const next = draft.trim();
                      const error = validatePageTitle(next);
                      if (error) throw new Error(error);
                      if (next !== editor.document.title)
                        editor.dispatch({ type: "update-page", title: next });
                    }}
                  >
                    <FieldDescription>
                      Applies on blur as its own undoable page command.
                    </FieldDescription>
                  </ValidatedInputField>
                  <TextField
                    label="Search title"
                    value={draft.seo.title}
                    maxLength={70}
                    disabled={readOnly}
                    onChange={(title) => updateSeo({ title })}
                  />
                  <TextField
                    label="Search description"
                    value={draft.seo.description}
                    maxLength={170}
                    multiline
                    disabled={readOnly}
                    onChange={(description) => updateSeo({ description })}
                  />
                  <TextField
                    label="Social title"
                    value={draft.seo.socialTitle}
                    maxLength={70}
                    disabled={readOnly}
                    onChange={(socialTitle) => updateSeo({ socialTitle })}
                  />
                  <TextField
                    label="Social description"
                    value={draft.seo.socialDescription}
                    maxLength={200}
                    multiline
                    disabled={readOnly}
                    onChange={(socialDescription) =>
                      updateSeo({ socialDescription })
                    }
                  />
                  <Field>
                    <FieldLabel>Social image</FieldLabel>
                    <FieldDescription>
                      {draft.seo.socialImage
                        ? `Current Resource: ${resourceKey(draft.seo.socialImage)}`
                        : "No social image selected."}
                    </FieldDescription>
                    <Button
                      variant="outline"
                      disabled={readOnly}
                      onClick={() => setMediaOpen(true)}
                    >
                      Choose social image
                    </Button>
                    {draft.seo.socialImage ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={readOnly}
                        onClick={() => updateSeo({ socialImage: null })}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Clear social image
                      </Button>
                    ) : null}
                  </Field>
                  <Field orientation="horizontal">
                    <div className="flex flex-1 flex-col gap-1">
                      <FieldLabel htmlFor="pb-page-no-index">
                        Hide from search engines
                      </FieldLabel>
                      <FieldDescription>
                        Sets the page's noindex metadata intent.
                      </FieldDescription>
                    </div>
                    <Switch
                      id="pb-page-no-index"
                      checked={draft.seo.noIndex}
                      disabled={readOnly}
                      onCheckedChange={(noIndex) => updateSeo({ noIndex })}
                    />
                  </Field>
                </FieldGroup>
              </TabsContent>
              <TabsContent value="variables">
                <VariableManager />
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="border-t px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={
                readOnly ||
                errors.length > 0 ||
                Boolean(pageTitleError) ||
                Object.values(invalidFields).some(Boolean)
              }
              onClick={() => {
                if (
                  JSON.stringify(draft) !==
                  JSON.stringify(editor.document.settings)
                )
                  editor.dispatch({ type: "update-settings", settings: draft });
                onOpenChange(false);
              }}
            >
              Apply page design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MediaPicker
        open={mediaOpen && open}
        onOpenChange={setMediaOpen}
        allowed={["image"]}
        label="Social image"
        onCommit={(items) => {
          if (items[0]) updateSeo({ socialImage: items[0].reference });
        }}
      />
    </>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
  onValidityChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
  readonly onValidityChange: (valid: boolean) => void;
}) {
  return (
    <ValidatedInputField
      label={label}
      value={String(value)}
      inputProps={{ type: "number", min, max, step: 1, disabled }}
      onValidityChange={onValidityChange}
      onCommit={(draft) => {
        const next = parseNumberDraft(draft, min, max);
        if (!Number.isInteger(next))
          throw new Error("Enter a whole number of pixels.");
        onChange(next);
      }}
    >
      <FieldDescription>
        {min}–{max} pixels.
      </FieldDescription>
    </ValidatedInputField>
  );
}

function TextField({
  label,
  value,
  maxLength,
  multiline = false,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
  readonly multiline?: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  const id = `pb-page-${label.toLowerCase().replaceAll(" ", "-")}`;
  const props = {
    id,
    value,
    maxLength,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.currentTarget.value),
  };
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? <Textarea {...props} /> : <Input {...props} />}
      <FieldDescription>
        {value.length}/{maxLength} characters.
      </FieldDescription>
    </Field>
  );
}
