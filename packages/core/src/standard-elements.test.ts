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
      const controls = definition.controls ?? [];
      expect(controls.every(({ key }) => key in defaults)).toBe(true);
      expect(JSON.parse(JSON.stringify(controls))).toEqual(controls);
      const styleControls = definition.styleControls ?? [];
      expect(styleControls.every(({ key }) => key in defaults)).toBe(true);
      expect(JSON.parse(JSON.stringify(styleControls))).toEqual(styleControls);
    }
  });

  it("owns element-specific visual controls in serializable definitions", () => {
    expect(
      builder.elements.get("logo")?.styleControls?.map(({ key }) => key),
    ).toEqual(["imageWidth", "imageFit", "imagePosition", "gap", "alignment"]);
    expect(
      builder.elements.get("menu")?.styleControls?.map(({ key }) => key),
    ).toEqual([
      "itemAlignment",
      "fullscreenVerticalAlignment",
      "itemAppearance",
      "itemBackground",
      "itemHoverBackground",
      "itemGap",
      "panelBackground",
      "panelPadding",
    ]);
    expect(builder.elements.get("gallery-carousel")?.styleControls).toEqual([
      {
        kind: "select",
        key: "layout",
        label: "Gallery layout",
        presentation: "segmented",
        options: [
          { label: "Square", value: "square" },
          { label: "Masonry", value: "masonry" },
          { label: "Carousel", value: "carousel" },
        ],
      },
    ]);
    expect(builder.elements.get("gallery-carousel")?.controls).toEqual([]);
  });

  it("owns typed Content control presentation in each definition", () => {
    expect(builder.elements.get("heading")?.controls).toEqual([
      { kind: "text", key: "content", label: "Content" },
      {
        kind: "select",
        key: "level",
        label: "Level",
        options: [
          { label: "Heading 1", value: 1 },
          { label: "Heading 2", value: 2 },
          { label: "Heading 3", value: 3 },
          { label: "Heading 4", value: 4 },
          { label: "Heading 5", value: 5 },
          { label: "Heading 6", value: 6 },
        ],
      },
    ]);
    expect(
      builder.elements
        .get("copyright")
        ?.controls?.find(({ key }) => key === "showYear"),
    ).toEqual({ kind: "boolean", key: "showYear", label: "Show Year" });
    expect(builder.elements.get("button")?.controls).toEqual([
      { kind: "text", key: "label", label: "Label" },
      { kind: "destination", key: "destination", label: "Destination" },
    ]);
    expect(builder.elements.get("image")?.controls).toEqual([
      { kind: "text", key: "alt", label: "Alternative text" },
      {
        kind: "boolean",
        key: "altConfirmed",
        label: "Alternative text confirmed",
      },
      { kind: "boolean", key: "decorative", label: "Decorative" },
      {
        kind: "destination",
        key: "destination",
        label: "Destination",
        nullable: true,
      },
      {
        kind: "select",
        key: "fit",
        label: "Fit",
        options: [
          { label: "Contain", value: "contain" },
          { label: "Cover", value: "cover" },
          { label: "Fill", value: "fill" },
          { label: "None", value: "none" },
          { label: "Scale down", value: "scale-down" },
        ],
      },
      {
        kind: "select",
        key: "position",
        label: "Position",
        options: [
          { label: "Top left", value: "top-left" },
          { label: "Top", value: "top" },
          { label: "Top right", value: "top-right" },
          { label: "Left", value: "left" },
          { label: "Centre", value: "center" },
          { label: "Right", value: "right" },
          { label: "Bottom left", value: "bottom-left" },
          { label: "Bottom", value: "bottom" },
          { label: "Bottom right", value: "bottom-right" },
        ],
      },
    ]);
    expect(builder.elements.get("menu")?.controls).toEqual([
      {
        kind: "select",
        key: "collapseAt",
        label: "Menu breakpoint",
        presentation: "viewport",
        options: [
          { label: "Desktop", value: "desktop" },
          { label: "Tablet", value: "tablet" },
          { label: "Mobile", value: "mobile" },
          { label: "No breakpoint", value: "never" },
        ],
      },
      {
        kind: "select",
        key: "presentation",
        label: "Collapse style",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
        options: [
          { label: "Full-width dropdown", value: "dropdown" },
          { label: "Full screen", value: "fullscreen" },
        ],
      },
      {
        kind: "select",
        key: "breakpointPosition",
        label: "On breakpoint",
        visibleWhen: { key: "collapseAt", notEquals: "never" },
        options: [
          { label: "Leave in place", value: "none" },
          { label: "Move to start", value: "start" },
          { label: "Move to center", value: "center" },
          { label: "Move to end", value: "end" },
        ],
      },
      {
        kind: "collection",
        key: "items",
        label: "Links",
        itemLabel: "Link",
        minItems: 1,
        maxItems: 30,
        idKey: "id",
        idPrefix: "menu-item",
        defaultItem: {
          label: "New link",
          destination: {
            type: "external",
            url: "https://example.com",
            newTab: false,
          },
        },
        itemControls: [
          { kind: "text", key: "label", label: "Label" },
          {
            kind: "destination",
            key: "destination",
            label: "Destination",
            preferFirstAnchor: true,
          },
        ],
      },
    ]);
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
