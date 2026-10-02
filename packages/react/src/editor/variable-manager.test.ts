import { describe, expect, it } from "vitest";

import { createPagebldr, standardFontFamilies } from "@pagebldr/core";

import {
  countVariableUsage,
  defaultVariableValues,
  validateVariableValue,
  variableKinds,
} from "./variable-manager.js";

describe("Variable manager", () => {
  it("supplies valid defaults for all six Variable kinds", () => {
    expect(variableKinds).toHaveLength(6);
    for (const kind of variableKinds)
      expect(
        validateVariableValue(kind, defaultVariableValues[kind]),
      ).toBeNull();
    expect(defaultVariableValues.typography).toBe(
      standardFontFamilies[0]!.value,
    );
  });

  it("reports kind-specific and unsafe values", () => {
    expect(validateVariableValue("color", "red")).toMatch(/hexadecimal/u);
    expect(validateVariableValue("radius", "-2px")).toMatch(/negative/u);
    expect(validateVariableValue("spacing", "2vw")).toMatch(/px, rem/u);
    expect(validateVariableValue("contentWidth", "60rem")).toMatch(/px or %/u);
    expect(validateVariableValue("shadow", "soft")).toMatch(/shadow values/u);
    expect(validateVariableValue("color", "#ffffff; color:red")).toMatch(
      /unsafe/u,
    );
  });

  it("counts each Element or Class style source once", () => {
    const builder = createPagebldr({ namespace: "variable-manager-test" });
    const document = builder.documents.create({ id: "page" });
    const root = document.elements[document.rootId]!;
    const withUsage = {
      ...document,
      elements: {
        ...document.elements,
        [root.id]: {
          ...root,
          styles: {
            desktop: {
              normal: {
                color: { type: "variable" as const, variableId: "brand" },
                backgroundColor: {
                  type: "variable" as const,
                  variableId: "brand",
                },
              },
            },
          },
        },
      },
      classes: {
        card: {
          id: "card",
          name: "Card",
          styles: {
            mobile: {
              hover: {
                borderColor: {
                  type: "variable" as const,
                  variableId: "brand",
                },
              },
            },
          },
        },
      },
      classOrder: ["card"],
      variables: {
        brand: {
          id: "brand",
          name: "Brand",
          kind: "color" as const,
          value: "#112233",
        },
      },
      variableOrder: ["brand"],
    };

    expect(countVariableUsage(withUsage, "brand")).toBe(2);
    expect(countVariableUsage(withUsage, "unused")).toBe(0);
  });
});
