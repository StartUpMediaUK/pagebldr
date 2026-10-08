"use client";
import { useEffect, useId, useState } from "react";
import { Button } from "../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import { usePagebldrEditor } from "./context.js";

export function SaveBlockDialog({
  elementId,
  open,
  onOpenChange,
}: {
  readonly elementId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const editor = usePagebldrEditor();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setName(editor.document.elements[elementId]?.name ?? "");
      setError(null);
    }
  }, [open, elementId]);
  const save = async () => {
    const label = name.trim();
    if (!label || label.length > 80) {
      setError("Use a name from 1 to 80 characters.");
      return;
    }
    if (
      !editor.librarySource?.saveBlock ||
      editor.mode !== "edit" ||
      elementId === editor.document.rootId
    )
      return;
    setPending(true);
    setError(null);
    try {
      const signal = new AbortController().signal;
      const saved = await editor.librarySource.listBlocks?.(signal);
      if (saved && saved.length >= 50)
        throw new Error("The saved Block library is full (50 Blocks).");
      await editor.librarySource.saveBlock({
        label,
        clipboard: editor.builder.editor.clipboard.copy(
          editor.document,
          elementId,
        ),
        signal,
      });
      editor.refreshLibrary();
      onOpenChange(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save this Block.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Block</DialogTitle>
          <DialogDescription>
            Save an independent copy of this subtree to your Host library.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor={id}>Block name</FieldLabel>
              <Input
                id={id}
                value={name}
                maxLength={80}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                disabled={pending}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              {error ? (
                <FieldError id={`${id}-error`}>{error}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save Block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
