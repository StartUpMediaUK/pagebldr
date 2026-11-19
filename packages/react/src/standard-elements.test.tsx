import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type PageElement,
} from "@pagebldr/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PagebldrRenderer } from "./index.js";
import allElementsFixture from "../../../fixtures/parity/all-elements.document.json";
import projectEnquiryFixture from "../../../fixtures/parity/project-enquiry.document.json";

const builder = createPagebldr({
  namespace: "standard-library",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

function standardDocument(): PageDocument {
  const base = builder.documents.create({ id: "standard" });
  const definitions = standardElements.filter(
    ({ type }) => type !== "container",
  );
  const container = standardElements.find(({ type }) => type === "container")!;
  const elements: Record<string, PageElement> = {
    root: {
      ...base.elements.root!,
      elementVersion: container.version,
      props: container.defaults() as Readonly<Record<string, unknown>>,
      children: definitions
        .filter(({ type }) => !["tab-panel", "accordion-panel"].includes(type))
        .map(({ type }) => type),
    },
  };
  for (const definition of definitions)
    elements[definition.type] = {
      id: definition.type,
      type: definition.type,
      elementVersion: definition.version,
      name: definition.label,
      props: definition.defaults() as Readonly<Record<string, unknown>>,
      children:
        definition.type === "content-tabs"
          ? ["tab-panel"]
          : definition.type === "content-accordion"
            ? ["accordion-panel"]
            : [],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
  return { ...base, elements };
}

describe("standard Element renderer", () => {
  it("serializes tab header appearance for editor, preview and server rendering without changing panel styles", () => {
    const source = standardDocument();
    const tabs = source.elements["content-tabs"]!;
    const document = {
      ...source,
      elements: {
        ...source.elements,
        [tabs.id]: {
          ...tabs,
          props: {
            ...tabs.props,
            tabColor: "#123456",
            tabActiveColor: "#ffffff",
            tabActiveBackground: "rgba(10, 20, 30, 0.5)",
            tabFocusColor: "#ff0000",
            tabFontSize: 22,
            tabPaddingX: 24,
            tabJustifyContent: "space-evenly",
            tabRadius: 8,
            tabIndicatorWidth: 4,
          },
        },
      },
    };
    expect(builder.documents.validate(document).valid).toBe(true);
    for (const mode of ["edit", "preview", "published"] as const) {
      const html = renderToString(
        <PagebldrRenderer builder={builder} document={document} mode={mode} />,
      );
      expect(html).toContain("--pagebldr-tab-authored-color:#123456");
      expect(html).toContain(
        "--pagebldr-tab-authored-active-background:rgba(10, 20, 30, 0.5)",
      );
      expect(html).toContain("--pagebldr-tab-font-size:22px");
      expect(html).toContain("--pagebldr-tab-padding-x:24px");
      expect(html).toContain("--pagebldr-tab-justify-content:space-evenly");
      expect(html).toContain("--pagebldr-tab-radius:8px");
      expect(html).toContain("--pagebldr-tab-indicator-width:4px");
    }
    expect(document.elements["tab-panel"]).toEqual(
      source.elements["tab-panel"],
    );
    expect(
      builder.documents.parse(JSON.parse(JSON.stringify(document))),
    ).toEqual(document);
    const legacy = {
      ...source,
      elements: {
        ...source.elements,
        [tabs.id]: {
          ...tabs,
          props: {
            ariaLabel: "Legacy",
            orientation: "horizontal",
            labelLayout: "wrap",
            activation: "automatic",
          },
        },
      },
    };
    expect(builder.documents.validate(legacy).valid).toBe(true);
    const invalid = {
      ...document,
      elements: {
        ...document.elements,
        [tabs.id]: {
          ...tabs,
          props: {
            ...tabs.props,
            tabBackground: "url(https://example.com/tracker)",
          },
        },
      },
    };
    expect(builder.documents.validate(invalid).valid).toBe(false);
  });
  it("gives a linked decorative gallery image an accessible destination name", () => {
    const source = standardDocument();
    const gallery = source.elements["gallery-carousel"]!;
    const document = {
      ...source,
      elements: {
        ...source.elements,
        [gallery.id]: {
          ...gallery,
          props: {
            ...gallery.props,
            items: [
              {
                id: "decorative-link",
                kind: "image",
                source: {
                  type: "external",
                  url: "https://example.com/photo.jpg",
                },
                alt: "",
                altConfirmed: true,
                decorative: true,
                caption: "View the collection",
                destination: {
                  type: "external",
                  url: "https://example.com/collection",
                  newTab: false,
                },
              },
            ],
            lightbox: true,
          },
        },
      },
    };
    expect(builder.documents.validate(document).valid).toBe(true);
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        mode="published"
      />,
    );
    expect(html).toMatch(
      /<a [^>]*aria-label="View the collection"[^>]*><img [^>]*alt=""/u,
    );
    expect(html).not.toContain("data-gallery-open");
  });
  it("emits hydration-safe raw CSS without permitting style-tag termination", () => {
    const document = {
      ...standardDocument(),
      id: "page</style><script>alert(1)</script>",
    };
    const html = renderToString(
      <PagebldrRenderer builder={builder} document={document} mode="edit" />,
    );
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
      (match) => match[1]!,
    );
    expect(styles.length).toBeGreaterThan(0);
    for (const css of styles) {
      expect(css).not.toContain("&quot;");
      expect(css).not.toContain("<");
      expect(css).not.toContain("&gt;");
    }
    expect(html).not.toContain("<script>");
    expect(styles.join(" ")).toContain('[data-pagebldr="standard-library"]');
  });
  it("renders Menu appearance and accessible panel identity with Document breakpoints", () => {
    const base = standardDocument();
    const document = {
      ...base,
      settings: {
        ...base.settings,
        breakpoints: { tabletMax: 1100, mobileMax: 700 },
      },
      elements: {
        ...base.elements,
        menu: {
          ...base.elements.menu!,
          props: {
            ...base.elements.menu!.props,
            collapseAt: "tablet",
            presentation: "fullscreen",
            itemAlignment: "center",
            fullscreenVerticalAlignment: "end",
            breakpointPosition: "start",
            itemAppearance: "background",
            itemGap: 40,
            itemBackground: "#123456",
            itemHoverBackground: "#654321",
          },
        },
      },
    };
    const html = renderToString(
      <PagebldrRenderer builder={builder} document={document} />,
    );
    expect(html).toContain('aria-controls="pagebldr-menu-panel"');
    expect(html).toContain('id="pagebldr-menu-panel"');
    expect(html).toContain('data-item-alignment="center"');
    expect(html).toContain('data-fullscreen-vertical-alignment="end"');
    expect(html).toContain('data-breakpoint-position="start"');
    expect(html).toContain('data-item-appearance="background"');
    expect(html).toContain("--pagebldr-menu-item-gap:40px");
    expect(html).toContain("--pagebldr-menu-item-background:#123456");
    expect(html).toContain("--pagebldr-menu-item-hover-background:#654321");
    expect(html).toContain(
      `@media (max-width:${document.settings.breakpoints.tabletMax}px)`,
    );
    expect(html).toContain("data-pagebldr-menu-styles");
    expect(html).toContain("@media (max-width:700px)");
    expect(html).not.toContain("@media (max-width:1024px)");
  });

  it("keeps Menu panel identity independent of editable anchors and honors a style nonce", () => {
    const base = standardDocument();
    const document = {
      ...base,
      elements: {
        ...base.elements,
        menu: {
          ...base.elements.menu!,
          props: {
            ...base.elements.menu!.props,
            anchorId: "primary-navigation",
          },
        },
      },
    };
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        styleNonce="test-nonce"
      />,
    );
    expect(html).toContain('id="primary-navigation"');
    expect(html).toContain('aria-controls="pagebldr-menu-panel"');
    expect(html).toContain(
      '<style nonce="test-nonce" data-pagebldr-menu-styles="standard">',
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal="true"');
  });

  it("renders every standard Element through its definition during SSR", () => {
    const document = standardDocument();
    expect(builder.documents.validate(document)).toMatchObject({ valid: true });
    const html = renderToString(
      <PagebldrRenderer builder={builder} document={document} />,
    );
    for (const definition of standardElements)
      expect(html).toContain(
        `data-pagebldr-element="${definition.type === "container" ? "root" : definition.type}"`,
      );
    expect(html).toContain("<h2");
    expect(html).toContain("<nav");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-pagebldr-widget="menu"');
    expect(html).toContain('data-pagebldr-widget="tabs"');
    expect(html).toContain('data-pagebldr-widget="countdown"');
    expect(html).not.toContain("next/");
  });

  it("shows unknown Elements only in edit mode", () => {
    const document = standardDocument();
    const unknown = {
      ...document,
      elements: {
        ...document.elements,
        heading: { ...document.elements.heading!, type: "missing-widget" },
      },
    };
    expect(
      renderToString(
        <PagebldrRenderer builder={builder} document={unknown} mode="edit" />,
      ),
    ).toContain("Unknown Element: missing-widget");
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={unknown}
          mode="published"
        />,
      ),
    ).not.toContain("Unknown Element");
  });

  it("can force the selected Element's authored interaction state in edit mode", () => {
    const document = standardDocument();
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        mode="edit"
        forcedStyleState={{ elementId: "heading", state: "hover" }}
      />,
    );
    expect(html).toContain(
      'data-pagebldr-element="heading" id="pagebldr-heading" data-pagebldr-force-state="hover"',
    );
    expect(html).not.toContain(
      'data-pagebldr-element="button" id="pagebldr-button" data-pagebldr-force-state',
    );
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={document}
          mode="published"
          forcedStyleState={{ elementId: "heading", state: "hover" }}
        />,
      ),
    ).not.toContain("data-pagebldr-force-state");
  });

  it("keeps hidden Elements discoverable only while editing", () => {
    const document = standardDocument();
    const hidden = {
      ...document,
      elements: {
        ...document.elements,
        heading: { ...document.elements.heading!, hidden: true },
      },
    };
    const editingHtml = renderToString(
      <PagebldrRenderer builder={builder} document={hidden} mode="edit" />,
    );
    expect(editingHtml).toContain('data-pagebldr-hidden="true"');
    expect(editingHtml).toContain("display:revert!important");
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={hidden}
          mode="published"
        />,
      ),
    ).not.toContain('id="pagebldr-heading"');
  });

  it("validates and SSR-renders the complete parity fixtures", () => {
    for (const input of [allElementsFixture, projectEnquiryFixture]) {
      const document = input as unknown as PageDocument;
      const validation = builder.documents.validate(document);
      if (!validation.valid) throw validation.error;
      const html = renderToString(
        <PagebldrRenderer builder={builder} document={document} />,
      );
      expect(html).toContain(`data-pagebldr-element="${document.rootId}"`);
      expect(html).not.toContain("Unknown Element");
    }
  });
});
