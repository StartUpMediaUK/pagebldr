"use client";

import {
  isAnchorIdDuplicate,
  normalizeAnchorId,
  type PageElement,
} from "@pagebldr/core";
import { FieldDescription } from "../components/ui/field.js";
import { usePagebldrEditor } from "./context.js";
import { ValidatedInputField } from "./validated-input-field.js";

export function AnchorControl({ element }: { readonly element: PageElement }) {
  const editor = usePagebldrEditor();
  const current =
    typeof element.props.anchorId === "string" ? element.props.anchorId : "";
  return (
    <ValidatedInputField
      label="ID"
      value={current}
      inputProps={{
        disabled: editor.mode !== "edit" || element.locked,
        maxLength: 80,
        placeholder: "how-it-works",
      }}
      onCommit={(draft) => {
        const anchorId = normalizeAnchorId(draft);
        if (
          isAnchorIdDuplicate(
            Object.values(editor.document.elements).map((entry) => ({
              elementId: entry.id,
              anchorId: entry.props.anchorId,
            })),
            element.id,
            anchorId,
          )
        )
          throw new Error("That ID is already used by another Element.");
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
      }}
    >
      <FieldDescription>
        Adds a unique page anchor and saves as you type. Destination controls
        list only Elements with an ID.
      </FieldDescription>
    </ValidatedInputField>
  );
}
