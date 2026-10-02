"use client";

import { useEffect, useId, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import {
  createId,
  findStandardFontFamily,
  standardFontFamilies,
  type PageDocument,
  type StyleVariable,
  type VariableKind,
} from "@pagebldr/core";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../components/ui/empty.js";
import { Field, FieldError, FieldLabel } from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import {
  NativeSelect,
  NativeSelectOption,
} from "../components/ui/native-select.js";
import { usePagebldrEditor } from "./context.js";

export const variableKinds = [
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "contentWidth",
] as const satisfies readonly VariableKind[];

export const variableKindLabels: Readonly<Record<VariableKind, string>> = {
  color: "Colour",
  typography: "Typography",
  spacing: "Spacing",
  radius: "Radius",
  shadow: "Shadow",
  contentWidth: "Content width",
};

export const defaultVariableValues: Readonly<Record<VariableKind, string>> = {
  color: "#172033",
  typography: standardFontFamilies[0]!.value,
  spacing: "16px",
  radius: "8px",
  shadow: "0px 4px 12px 0px rgb(15 23 42 / 16%)",
  contentWidth: "1200px",
};

export function countVariableUsage(
  document: PageDocument,
  variableId: string,
): number {
  const usesVariable = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(usesVariable);
    const record = value as Record<string, unknown>;
    if (record.type === "variable" && record.variableId === variableId)
      return true;
    return Object.values(record).some(usesVariable);
  };
  return (
    Object.values(document.elements).filter((element) =>
      usesVariable(element.styles),
    ).length +
    Object.values(document.classes).filter((styleClass) =>
      usesVariable(styleClass.styles),
    ).length
  );
}

export function validateVariableValue(
  kind: VariableKind,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a value.";
  if (
    /[;{}<>]|\/\*|\*\/|javascript\s*:|expression\s*\(|@import/iu.test(trimmed)
  )
    return "The value contains unsafe CSS syntax.";
  if (kind === "color" && !/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(trimmed))
    return "Use a six- or eight-digit hexadecimal colour.";
  if (kind === "typography" && !findStandardFontFamily(trimmed))
    return "Choose a supported font family.";
  if (kind === "spacing" && !/^-?(?:\d+|\d*\.\d+)(?:px|rem|%)$/u.test(trimmed))
    return "Use a number followed by px, rem, or %.";
  if (
    (kind === "radius" || kind === "contentWidth") &&
    !/^-?(?:\d+|\d*\.\d+)(?:px|%)$/u.test(trimmed)
  )
    return "Use a number followed by px or %.";
  if ((kind === "radius" || kind === "contentWidth") && trimmed.startsWith("-"))
    return "This value cannot be negative.";
  if (
    kind === "shadow" &&
    !/^-?\d+(?:\.\d+)?px\s+-?\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px\s+-?\d+(?:\.\d+)?px\s+.+(?:\s+inset)?$/u.test(
      trimmed,
    )
  )
    return "Use x, y, blur, spread, and colour shadow values.";
  return null;
}

export function VariableManager() {
  const editor = usePagebldrEditor();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<VariableKind>("color");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const readOnly = editor.mode !== "edit";
  const variables = editor.document.variableOrder
    .map((id) => editor.document.variables[id])
    .filter((variable): variable is StyleVariable => Boolean(variable));
  const normalizedName = newName.trim().toLocaleLowerCase();
  const duplicateNewName = variables.some(
    (variable) => variable.name.trim().toLocaleLowerCase() === normalizedName,
  );
  const pendingDelete = pendingDeleteId
    ? editor.document.variables[pendingDeleteId]
    : undefined;

  const addVariable = () => {
    const name = newName.trim();
    if (!name || name.length > 120 || duplicateNewName) return;
    editor.dispatch({
      type: "add-variable",
      variable: {
        id: createId("variable"),
        name,
        kind: newKind,
        value: defaultVariableValues[newKind],
      },
    });
    setNewName("");
  };

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="pb-new-variable-name">Add variable</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <Input
            id="pb-new-variable-name"
            value={newName}
            maxLength={120}
            placeholder="New variable name"
            disabled={readOnly}
            aria-invalid={duplicateNewName}
            onChange={(event) => setNewName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addVariable();
            }}
          />
          <NativeSelect
            value={newKind}
            aria-label="New variable kind"
            disabled={readOnly}
            onChange={(event) =>
              setNewKind(event.currentTarget.value as VariableKind)
            }
          >
            {variableKinds.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {variableKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            disabled={readOnly || !newName.trim() || duplicateNewName}
            onClick={addVariable}
          >
            <SparklesIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
        {duplicateNewName ? (
          <FieldError>A Variable with this name already exists.</FieldError>
        ) : (
          <p className="text-xs text-muted-foreground">
            Kind controls where the Variable can be selected in Style.
          </p>
        )}
      </Field>

      {variables.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>No design Variables yet</EmptyTitle>
            <EmptyDescription>
              Variables keep shared colours, typography, spacing, and other
              style values consistent.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        variableKinds.map((kind) => {
          const group = variables.filter((variable) => variable.kind === kind);
          if (group.length === 0) return null;
          return (
            <section className="flex flex-col gap-2" key={kind}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {variableKindLabels[kind]}
              </h3>
              {group.map((variable, groupIndex) => (
                <VariableRow
                  key={variable.id}
                  variable={variable}
                  variables={variables}
                  usageCount={countVariableUsage(editor.document, variable.id)}
                  readOnly={readOnly}
                  canMoveUp={groupIndex > 0}
                  canMoveDown={groupIndex < group.length - 1}
                  onMove={(direction) => {
                    const neighbor = group[groupIndex + direction];
                    if (!neighbor) return;
                    const neighborIndex = editor.document.variableOrder.indexOf(
                      neighbor.id,
                    );
                    editor.dispatch({
                      type: "reorder-variable",
                      variableId: variable.id,
                      index: neighborIndex,
                    });
                  }}
                  onDelete={() => {
                    const used = countVariableUsage(
                      editor.document,
                      variable.id,
                    );
                    if (used > 0) setPendingDeleteId(variable.id);
                    else
                      editor.dispatch({
                        type: "delete-variable",
                        variableId: variable.id,
                      });
                  }}
                />
              ))}
            </section>
          );
        })
      )}

      <p className="text-xs text-muted-foreground">
        Variable changes apply immediately and remain available through Undo.
      </p>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This Variable is used in{" "}
              {pendingDelete
                ? countVariableUsage(editor.document, pendingDelete.id)
                : 0}{" "}
              style source(s). Deleting it clears those declarations so they
              inherit again. You can undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                editor.dispatch({
                  type: "delete-variable",
                  variableId: pendingDelete.id,
                  force: true,
                });
                setPendingDeleteId(null);
              }}
            >
              Delete Variable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VariableRow({
  canMoveDown,
  canMoveUp,
  onDelete,
  onMove,
  readOnly,
  usageCount,
  variable,
  variables,
}: {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly onDelete: () => void;
  readonly onMove: (direction: -1 | 1) => void;
  readonly readOnly: boolean;
  readonly usageCount: number;
  readonly variable: StyleVariable;
  readonly variables: readonly StyleVariable[];
}) {
  const editor = usePagebldrEditor();
  const nameId = useId();
  const valueId = useId();
  const [name, setName] = useState(variable.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [value, setValue] = useState(String(variable.value));
  const [valueError, setValueError] = useState<string | null>(null);

  useEffect(() => setName(variable.name), [variable.name]);
  useEffect(() => setValue(String(variable.value)), [variable.value]);

  const commitName = () => {
    const next = name.trim();
    const duplicate = variables.some(
      (entry) =>
        entry.id !== variable.id &&
        entry.name.trim().toLocaleLowerCase() === next.toLocaleLowerCase(),
    );
    const error = !next
      ? "Enter a name."
      : next.length > 120
        ? "Use 120 characters or fewer."
        : duplicate
          ? "Variable names must be unique."
          : null;
    setNameError(error);
    if (!error && next !== variable.name)
      editor.dispatch({
        type: "update-variable",
        variableId: variable.id,
        patch: { name: next },
      });
  };
  const commitValue = (next = value) => {
    const trimmed = next.trim();
    const error = validateVariableValue(variable.kind, trimmed);
    setValueError(error);
    if (!error && trimmed !== String(variable.value))
      editor.dispatch({
        type: "update-variable",
        variableId: variable.id,
        patch: { value: trimmed },
      });
  };

  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(8rem,0.8fr)_minmax(12rem,1.2fr)_auto] md:items-start">
      <Field>
        <FieldLabel htmlFor={nameId} className="sr-only">
          {variableKindLabels[variable.kind]} Variable name
        </FieldLabel>
        <Input
          id={nameId}
          value={name}
          maxLength={120}
          disabled={readOnly}
          aria-invalid={Boolean(nameError)}
          onChange={(event) => {
            setName(event.currentTarget.value);
            setNameError(null);
          }}
          onBlur={commitName}
        />
        {nameError ? <FieldError>{nameError}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={valueId} className="sr-only">
          {variable.name} value
        </FieldLabel>
        {variable.kind === "typography" ? (
          <NativeSelect
            id={valueId}
            value={findStandardFontFamily(value)?.value ?? ""}
            disabled={readOnly}
            aria-invalid={Boolean(valueError)}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setValue(next);
              commitValue(next);
            }}
          >
            {!findStandardFontFamily(value) ? (
              <NativeSelectOption value="">Unsupported font</NativeSelectOption>
            ) : null}
            {standardFontFamilies.map((font) => (
              <NativeSelectOption key={font.value} value={font.value}>
                {font.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <div className="flex items-center gap-2">
            {variable.kind === "color" ? (
              <span
                aria-hidden="true"
                className="size-8 shrink-0 rounded-full border"
                style={{
                  backgroundColor: validateVariableValue("color", value)
                    ? "transparent"
                    : value,
                }}
              />
            ) : null}
            <Input
              id={valueId}
              value={value}
              disabled={readOnly}
              aria-invalid={Boolean(valueError)}
              onChange={(event) => {
                setValue(event.currentTarget.value);
                setValueError(null);
              }}
              onBlur={() => commitValue()}
            />
          </div>
        )}
        {valueError ? <FieldError>{valueError}</FieldError> : null}
      </Field>
      <div className="flex items-center justify-end gap-1">
        <Badge variant="outline">
          {usageCount} {usageCount === 1 ? "use" : "uses"}
        </Badge>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Move ${variable.name} up`}
          disabled={readOnly || !canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Move ${variable.name} down`}
          disabled={readOnly || !canMoveDown}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete ${variable.name}`}
          disabled={readOnly}
          onClick={onDelete}
        >
          <Trash2Icon data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}
