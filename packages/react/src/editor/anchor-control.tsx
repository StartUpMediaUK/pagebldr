"use client";

import { useState } from "react";

import {
  isAnchorIdDuplicate,
  normalizeAnchorId,
  type PageDocument,
  type PageElement,
} from "@pagebldr/core";
import { Field, FieldDescription, FieldLabel } from "../components/ui/field.js";
import { Input } from "../components/ui/input.js";
import { usePagebldrEditor } from "./context.js";

function authoredAnchors(document: PageDocument) {
  return Object.values(document.elements).map((element) => ({
    elementId: element.id,
    anchorId: element.props.anchorId,
  }));
}

export function AnchorControl({ element }: { readonly element: PageElement }) {
  const editor = usePagebldrEditor();
  const current =
    typeof element.props.anchorId === "string" ? element.props.anchorId : "";
  const [draft, setDraft] = useState({
    elementId: element.id,
    value: current,
  });
  const candidate = draft.elementId === element.id ? draft.value : current;
  const normalizedCandidate = normalizeAnchorId(candidate);
  const candidateIsDuplicate = isAnchorIdDuplicate(
    authoredAnchors(editor.document),
    element.id,
    normalizedCandidate,
  );
  const useDraft =
    draft.elementId === element.id &&
    (normalizedCandidate === current || candidateIsDuplicate);
  const value = useDraft ? candidate : current;
  const normalized = normalizeAnchorId(value);
  const duplicate = useDraft && candidateIsDuplicate;
  const persist = (anchorId: string) => {
    if (anchorId === current) return;
    editor.dispatch(
      anchorId
        ? {
            type: "update-props",
            elementId: element.id,
            patch: { anchorId },
          }
        : {
            type: "update-props",
            elementId: element.id,
            patch: {},
            unset: ["anchorId"],
          },
      `anchor:${element.id}`,
    );
  };

  return (
    <Field data-invalid={duplicate || undefined}>
      <FieldLabel htmlFor="pb-element-anchor">ID</FieldLabel>
      <Input
        id="pb-element-anchor"
        aria-invalid={duplicate || undefined}
        disabled={editor.mode !== "edit" || element.locked}
        maxLength={80}
        placeholder="how-it-works"
        value={value}
        onBlur={() =>
          setDraft({
            elementId: element.id,
            value: duplicate ? current : normalized,
          })
        }
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          const anchorId = normalizeAnchorId(nextDraft);
          setDraft({ elementId: element.id, value: nextDraft });
          if (
            !isAnchorIdDuplicate(
              authoredAnchors(editor.document),
              element.id,
              anchorId,
            )
          )
            persist(anchorId);
        }}
      />
      <FieldDescription>
        {duplicate
          ? "That ID is already used by another Element."
          : "Adds a unique page anchor and saves as you type. Destination controls list only Elements with an ID."}
      </FieldDescription>
    </Field>
  );
}
