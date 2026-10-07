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

describe("nested inspector field command contracts", () => {
  for (const definition of standardElements) {
    const element = Object.values(document.elements).find(
      (item) => item.type === definition.type,
    )!;
    for (const control of definition.controls ?? []) {
      if (control.kind !== "collection") continue;
      const rawItems = element.props[control.key];
      if (!Array.isArray(rawItems) || !rawItems.length) continue;
      const items = rawItems as readonly Readonly<Record<string, unknown>>[];
      for (const field of control.itemControls) {
        it(`${definition.type}.${String(control.key)}[item].${String(field.key)} rejects invalid types and undoes accepted edits`, async () => {
          const original = items[0]![field.key];
          const candidates =
            field.kind === "select"
              ? field.options.map(({ value }) => value)
              : field.kind === "destination"
                ? [
                    {
                      type: "external",
                      url: "https://example.com/inspector",
                      newTab: false,
                    },
                  ]
                : field.key === "url"
                  ? ["https://example.com/inspector"]
                  : [
                      typeof original === "boolean"
                        ? !original
                        : typeof original === "number"
                          ? original + 1
                          : `${typeof original === "string" ? original : ""} edited`,
                    ];
          const patch = (value: unknown) => ({
            [control.key]: items.map((item, index) =>
              index === 0 ? { ...item, [field.key]: value } : item,
            ),
          });
          const initial = builder.editor.history.create(document);
          let accepted: unknown = original;
          for (const candidate of candidates) {
            if (candidate === original) continue;
            const checked = await definition.props["~standard"].validate({
              ...element.props,
              ...patch(candidate),
            });
            if (
              checked &&
              typeof checked === "object" &&
              (!("issues" in checked) || !checked.issues)
            ) {
              accepted = candidate;
              break;
            }
          }
          expect(accepted).not.toEqual(original);
          const changed = builder.editor.history.commit(
            initial,
            {
              type: "update-props",
              elementId: element.id,
              patch: patch(accepted),
            },
            {
              coalesceKey: `prop:${element.id}:${String(control.key)}`,
              timestamp: 100,
            },
          );
          expect(builder.editor.history.undo(changed).present).toEqual(
            document,
          );
          expect(() =>
            builder.editor.history.commit(initial, {
              type: "update-props",
              elementId: element.id,
              patch: patch({ invalid: true }),
            }),
          ).toThrow();
          expect(initial.present).toEqual(document);
        });
      }
    }
  }
});

it("invalid social URL produces validation issues rather than an uncaught URL exception", async () => {
  const definition = standardElements.find(
    (element) => element.type === "social-links",
  )!;
  const element = Object.values(document.elements).find(
    (element) => element.type === "social-links",
  )!;
  const result = await definition.props["~standard"].validate({
    ...element.props,
    links: [{ id: "social-invalid", platform: "instagram", url: "not a URL" }],
  });
  expect(result).toHaveProperty("issues");
});
