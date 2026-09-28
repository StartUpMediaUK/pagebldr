import { describe, expect, it } from "vitest";

import { createPagebldr } from "@pagebldr/core";
import { anchoredElements, destinationForType } from "./destination-control.js";

describe("destination Content control", () => {
  it("offers only Elements with authored anchors", () => {
    const builder = createPagebldr({ namespace: "destination-control-test" });
    const created = builder.documents.create({ id: "page", title: "Page" });
    const document = {
      ...created,
      elements: {
        root: {
          ...created.elements.root!,
          props: { anchorId: "introduction" },
        },
        plain: {
          ...created.elements.root!,
          id: "plain",
          name: "Plain section",
          props: {},
        },
      },
    };

    expect(anchoredElements(document)).toEqual([
      { id: "root", anchorId: "introduction", name: "Page" },
    ]);
  });

  it("creates neutral defaults for every destination type", () => {
    const anchors = [{ id: "section", anchorId: "section", name: "Section" }];
    const applications = [
      {
        label: "Pricing",
        reference: { kind: "route", value: "/pricing" },
      },
    ];

    expect(destinationForType("external", anchors, applications)).toEqual({
      type: "external",
      url: "https://example.com",
      newTab: false,
    });
    expect(destinationForType("anchor", anchors, applications)).toEqual({
      type: "anchor",
      elementId: "section",
    });
    expect(destinationForType("email", anchors, applications)).toEqual({
      type: "email",
      address: "hello@example.com",
    });
    expect(destinationForType("telephone", anchors, applications)).toEqual({
      type: "telephone",
      number: "+44 20 1234 5678",
    });
    expect(destinationForType("application", anchors, applications)).toEqual({
      type: "application",
      reference: { kind: "route", value: "/pricing" },
      newTab: false,
    });
  });

  it("does not invent unavailable anchor or application references", () => {
    expect(destinationForType("anchor", [], [])).toBeNull();
    expect(destinationForType("application", [], [])).toBeNull();
  });
});
