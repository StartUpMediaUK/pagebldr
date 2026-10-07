import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/parity/all-elements.document.json" with { type: "json" };
import { createPagebldr } from "./config.js";
import {
  standardElements,
  standardStyleCapabilities,
} from "./standard-elements.js";

const builder = createPagebldr({
  namespace: "inspector-fields",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const document = builder.documents.migrate(fixture);

describe("standard scalar inspector field command contracts", () => {
  for (const definition of standardElements) {
    const element = Object.values(document.elements).find(
      (item) => item.type === definition.type,
    )!;
    for (const control of [
      ...(definition.controls ?? []),
      ...(definition.styleControls ?? []),
    ]) {
      if (!["text", "number", "boolean", "select"].includes(control.kind))
        continue;
      it(`${definition.type}.${String(control.key)} validates, coalesces and undoes at the public interface`, async () => {
        const current = element.props[control.key];
        const candidates =
          control.kind === "select"
            ? control.options.map(({ value }) => value)
            : control.kind === "boolean"
              ? [!current]
              : control.kind === "number"
                ? [
                    Number(current) + (control.step ?? 1),
                    Number(current) - (control.step ?? 1),
                  ]
                : control.kind === "text" && control.presentation === "color"
                  ? ["#112233", "#445566"]
                  : control.key === "targetDate"
                    ? ["2031-12-31T23:59:59.000Z"]
                    : [`${String(current)} edited`, "Edited"];
        const accepted = [];
        for (const value of candidates) {
          if (value === current) continue;
          const result = await definition.props["~standard"].validate({
            ...element.props,
            [control.key]: value,
          });
          if (
            result &&
            typeof result === "object" &&
            (!("issues" in result) || !result.issues)
          )
            accepted.push(value);
        }
        expect(accepted.length).toBeGreaterThan(0);
        const initial = builder.editor.history.create(document);
        const command = (value: unknown) => ({
          type: "update-props" as const,
          elementId: element.id,
          patch: { [control.key]: value },
        });
        const options = {
          coalesceKey: `prop:${element.id}:${String(control.key)}`,
          timestamp: 100,
        };
        const changed = builder.editor.history.commit(
          initial,
          command(accepted[0]),
          options,
        );
        const coalesced = builder.editor.history.commit(
          changed,
          command(current),
          { ...options, timestamp: 200 },
        );
        expect(coalesced.past).toHaveLength(1);
        expect(builder.editor.history.undo(changed).present).toEqual(document);
        expect(() =>
          builder.editor.history.commit(initial, command({ invalid: true })),
        ).toThrow();
        expect(initial.present).toEqual(document);
      });
    }
  }
});
