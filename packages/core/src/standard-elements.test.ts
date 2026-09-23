import { describe, expect, it } from "vitest";

import { createPagebldr } from "./config.js";
import {
  standardElements,
  standardStyleCapabilities,
} from "./standard-elements.js";

const expectedTypes = [
  "container",
  "heading",
  "rich-text",
  "button",
  "logo",
  "menu",
  "copyright",
  "image",
  "video",
  "icon",
  "divider",
  "spacer",
  "list",
  "icon-list",
  "accordion",
  "tabs",
  "testimonial",
  "star-rating",
  "counter",
  "progress",
  "countdown",
  "social-links",
  "logo-cloud",
  "gallery-carousel",
] as const;

const builder = createPagebldr({
  namespace: "standard-elements-test",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

describe("standard Elements", () => {
  it("ships the complete typed 24-Element library", () => {
    expect(standardElements.map(({ type }) => type)).toEqual(expectedTypes);
    for (const definition of standardElements) {
      const defaults = definition.defaults() as Record<string, unknown>;
      const result = definition.props["~standard"].validate(defaults);
      expect(result).toHaveProperty("value");
      expect(definition.controls?.map(({ key }) => key)).toEqual(
        Object.keys(defaults),
      );
    }
  });

  it("rejects unknown properties instead of accepting generic records", () => {
    for (const definition of standardElements) {
      const result = definition.props["~standard"].validate({
        ...(definition.defaults() as Record<string, unknown>),
        notARealProperty: true,
      });
      expect(result).toHaveProperty("issues");
    }
  });

  it("keeps inline editing behavior with the owning Element definition", () => {
    const heading = builder.elements.get("heading")!;
    expect(heading.inlineEditing?.read({ content: "Original", level: 2 })).toBe(
      "Original",
    );
    expect(
      heading.inlineEditing?.update("Changed", {
        content: "Original",
        level: 2,
      }),
    ).toEqual({ content: "Changed" });

    const richText = builder.elements.get("rich-text")!;
    const props = {
      content: [
        { type: "heading", text: "First" },
        { type: "paragraph", text: "Second" },
      ],
    };
    expect(richText.inlineEditing?.read(props)).toBe("First\nSecond");
    expect(richText.inlineEditing?.update("Changed\nAgain", props)).toEqual({
      content: [
        { type: "heading", text: "Changed" },
        { type: "paragraph", text: "Again" },
      ],
    });
  });

  it("migrates package-native Image, Video, Progress and Gallery v1 props", () => {
    const cases = [
      ["image", { src: "https://example.com/image.jpg", alt: "Example" }],
      ["video", { src: "https://example.com/video.mp4", title: "Example" }],
      [
        "progress",
        {
          value: 50,
          label: "Halfway",
          showLabel: true,
          showValue: true,
          trackColor: "#eeeeee",
          indicatorColor: "#111111",
        },
      ],
      [
        "gallery-carousel",
        {
          mode: "gallery",
          images: [
            {
              id: "one",
              source: { type: "external", url: "https://example.com/one.jpg" },
              alt: "One",
              caption: "First",
            },
          ],
        },
      ],
    ] as const;
    for (const [type, props] of cases) {
      const definition = builder.elements.get(type)!;
      expect(definition.version).toBe(2);
      expect(definition.migrate?.(props, 1)).toBeTruthy();
    }
  });

  it("discovers all nested Resource references and Destinations", () => {
    const resource = { kind: "media", value: "asset-1" } as const;
    const gallery = builder.elements.get("gallery-carousel")!;
    expect(
      gallery.references?.({
        layout: "square",
        items: [
          {
            id: "one",
            kind: "image",
            source: { type: "resource", reference: resource },
            alt: "One",
            altConfirmed: true,
            decorative: false,
            caption: "",
          },
        ],
      }),
    ).toEqual([resource]);

    const destination = {
      type: "external",
      url: "https://example.com",
      newTab: false,
    } as const;
    expect(
      builder.elements.get("menu")!.destinations?.({
        ...(builder.elements.get("menu")!.defaults() as Record<
          string,
          unknown
        >),
        items: [{ id: "one", label: "One", destination }],
      }),
    ).toEqual([destination]);
  });
});
