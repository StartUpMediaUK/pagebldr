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
  const [activeTab, setActiveTab] = useState<PageDesignTab>("design");
  const [pageTitle, setPageTitle] = useState(editor.document.title);
  const [pageTitleError, setPageTitleError] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const readOnly = editor.mode !== "edit";
  const errors = validatePageDesign(draft);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(structuredClone(editor.document.settings));
      setPageTitle(editor.document.title);
      setPageTitleError(null);
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
  const updateSeo = (patch: Partial<PageSettings["seo"]>) =>
    setDraft((current) => ({
      ...current,
      seo: { ...current.seo, ...patch },
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(48rem,calc(100%-2rem))] overflow-hidden p-0 sm:max-w-2xl">
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
                  label="Content width"
                  value={draft.contentWidth}
                  min={320}
                  max={2_400}
                  disabled={readOnly}
                  onChange={(contentWidth) => update({ contentWidth })}
                />
                <NumberField
                  label="Tablet maximum"
                  value={draft.breakpoints.tabletMax}
                  min={768}
                  max={1_200}
                  disabled={readOnly}
                  onChange={(tabletMax) => updateBreakpoints({ tabletMax })}
                />
                <NumberField
                  label="Mobile maximum"
                  value={draft.breakpoints.mobileMax}
                  min={320}
                  max={767}
                  disabled={readOnly}
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
                <Field>
                  <FieldLabel htmlFor="pb-page-title">Page title</FieldLabel>
                  <Input
                    id="pb-page-title"
                    value={pageTitle}
                    maxLength={160}
                    disabled={readOnly}
                    aria-invalid={Boolean(pageTitleError)}
                    onChange={(event) => {
                      setPageTitle(event.currentTarget.value);
                      setPageTitleError(null);
                    }}
                    onBlur={() => {
                      const next = pageTitle.trim();
                      const error = validatePageTitle(next);
                      setPageTitleError(error);
                      if (!error && next !== editor.document.title)
                        editor.dispatch({ type: "update-page", title: next });
                    }}
                  />
                  {pageTitleError ? (
                    <FieldError>{pageTitleError}</FieldError>
                  ) : (
                    <FieldDescription>
                      Applies on blur as its own undoable page command.
                    </FieldDescription>
                  )}
                </Field>
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
                      : "No social image selected. Selection is provided by the shared media picker."}
                  </FieldDescription>
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
            disabled={readOnly || errors.length > 0 || Boolean(pageTitleError)}
            onClick={() => {
              editor.dispatch({ type: "update-settings", settings: draft });
              onOpenChange(false);
            }}
          >
            Apply page design
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}) {
  const id = `pb-page-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (!Number.isNaN(next)) onChange(next);
        }}
      />
      <FieldDescription>
        {min}–{max} pixels.
      </FieldDescription>
    </Field>
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
