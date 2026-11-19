import { useEffect, useId, useState } from "react";
import {
  createPagebldr,
  defineBlock,
  defineElement,
  resolveDocumentResources,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type PageElement,
  type PreparedResources,
  type StandardSchemaV1,
} from "@startupmedia/pagebldr";
import {
  defineReactElementRenderer,
  defineEditorContribution,
  defineEditorPreset,
  standardEditorPreset,
  PagebldrEditor,
  PagebldrRenderer,
  PagebldrRuntimeInteractions,
} from "@startupmedia/pagebldr/react";

type FormProps = { formId: string; label: string };
const formSchema: StandardSchemaV1<unknown, FormProps> = {
  "~standard": {
    version: 1,
    vendor: "reference-host",
    validate(value) {
      if (
        value &&
        typeof value === "object" &&
        "formId" in value &&
        typeof value.formId === "string" &&
        value.formId.length > 0 &&
        "label" in value &&
        typeof value.label === "string" &&
        value.label.length > 0 &&
        Object.keys(value).every((key) => ["formId", "label"].includes(key))
      )
        return { value: { formId: value.formId, label: value.label } };
      return { issues: [{ message: "Expected a form reference and label." }] };
    },
  },
};

export const demoForm = defineElement({
  type: "host-demo-form",
  version: 1,
  label: "Host demo form",
  props: formSchema,
  defaults: () => ({ formId: "enquiry", label: "Request information" }),
  childPolicy: { kind: "none" },
  controls: [
    { kind: "text", key: "formId", label: "Form reference" },
    { kind: "text", key: "label", label: "Label" },
  ],
  references: (props) => [{ kind: "demo-form", value: props.formId }],
  render: (props) => ({
    tag: "p",
    children: [`${props.label}: interactive form unavailable.`],
  }),
});

export const demoFormRenderer = defineReactElementRenderer(
  demoForm,
  function DemoForm({ props, context }) {
    const inputId = useId();
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);
    const [state, setState] = useState<
      "idle" | "pending" | "error" | "success"
    >("idle");
    const resource = context.resource({
      kind: "demo-form",
      value: props.formId,
    });
    if (context.mode === "edit")
      return <p>{props.label} — form preview; submissions disabled.</p>;
    if (!resource)
      return <p role="status">This form is currently unavailable.</p>;
    return (
      <form
        aria-label={props.label}
        onSubmit={(event) => {
          event.preventDefault();
          if (state === "pending") return;
          const emailValue = new FormData(event.currentTarget).get("email");
          const email = typeof emailValue === "string" ? emailValue : "";
          setState("pending");
          // Stub Host service. No request or credential leaves this example.
          void new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              if (email.startsWith("fail"))
                reject(new Error("Example failure"));
              else resolve();
            }, 350),
          ).then(
            () => setState("success"),
            () => setState("error"),
          );
        }}
      >
        <label htmlFor={inputId}>Email</label>{" "}
        <input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
        />{" "}
        <button type="submit" disabled={!hydrated || state === "pending"}>
          Send request
        </button>
        <p role={state === "error" ? "alert" : "status"}>
          {state === "pending"
            ? "Sending…"
            : state === "error"
              ? "Example failure. Try another address."
              : state === "success"
                ? "Request received."
                : "Use fail@example.com to exercise an error."}
        </p>
      </form>
    );
  },
);

export function CapabilityPage({
  document,
  resources,
}: {
  readonly document: PageDocument;
  readonly resources: PreparedResources;
}) {
  return (
    <div>
      <PagebldrRuntimeInteractions />
      <PagebldrRenderer
        builder={capabilityBuilder}
        document={document}
        resources={resources}
        elementRenderers={[demoFormRenderer]}
        mode="published"
      />
    </div>
  );
}

const stringSchema: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "reference-host",
    validate: (value) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Expected a string." }] },
  },
};
export const capabilityBuilder = createPagebldr({
  namespace: "modular-content",
  elements: [...standardElements, demoForm],
  styleCapabilities: standardStyleCapabilities,
  resources: {
    "demo-image": {
      reference: stringSchema,
      resolve: (id) =>
        typeof id === "string" ? `/capability-image-${id}.svg` : null,
    },
    "demo-form": {
      reference: stringSchema,
      resolve: (id) =>
        typeof id === "string" && id !== "missing"
          ? `/demo-form/${encodeURIComponent(id)}`
          : null,
    },
  },
});

export const contentPanelBlock = defineBlock({
  key: "content-panels",
  label: "Content panels with a Host form",
  create: () => ({
    type: "content-tabs",
    children: [
      {
        type: "tab-panel",
        props: { label: "Overview" },
        children: [{ type: "heading", props: { content: "Overview" } }],
      },
      {
        type: "tab-panel",
        props: { label: "Enquire" },
        children: [{ type: "host-demo-form" }],
      },
    ],
  }),
});

export function capabilityDocument(): PageDocument {
  const builder = capabilityBuilder;
  const base = builder.documents.create({ id: "modular-content-example" });
  const elements: Record<string, PageElement> = { ...base.elements };
  const add = (
    id: string,
    type: string,
    props: Record<string, unknown> = {},
    children: readonly string[] = [],
    styles: PageElement["styles"] = {},
  ) => {
    const definition = builder.elements.get(type)!;
    elements[id] = {
      ...base.elements[base.rootId]!,
      id,
      type,
      name: id,
      elementVersion: definition.version,
      props: {
        ...(definition.defaults() as Record<string, unknown>),
        ...props,
      },
      children,
      styles,
    };
  };
  add("header", "container", { tag: "header" }, ["inset"], {
    desktop: {
      normal: { position: "sticky", top: "12px", zIndex: 30, padding: "12px" },
    },
  });
  add("inset", "container", {}, ["brand", "nav", "cta"], {
    desktop: {
      normal: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px",
        borderRadius: "20px",
        backgroundColor: "#ffffff",
      },
    },
    mobile: { normal: { flexWrap: "wrap" } },
  });
  add("brand", "logo", { text: "Example" });
  add("nav", "menu", {
    items: [
      {
        id: "learn",
        label: "Learn",
        destination: { type: "anchor", elementId: "intro" },
        children: [
          {
            id: "browse",
            label: "Browse",
            children: [
              {
                id: "gallery",
                label: "Gallery",
                destination: { type: "anchor", elementId: "grid" },
              },
            ],
          },
          {
            id: "contact",
            label: "Contact",
            destination: { type: "anchor", elementId: "tabs" },
          },
        ],
      },
    ],
  });
  add("cta", "button", {
    label: "Enquire",
    destination: { type: "anchor", elementId: "tabs" },
  });
  add("intro", "heading", {
    content: "Modular content capabilities",
    level: 1,
  });
  add("tabs", "content-tabs", { activation: "manual" }, [
    "overview",
    "enquire",
    "unavailable",
  ]);
  add("overview", "tab-panel", { label: "Overview" }, [
    "intro-copy",
    "nested-tabs",
  ]);
  add("intro-copy", "rich-text");
  add("nested-tabs", "content-tabs", { orientation: "vertical" }, [
    "nested-panel",
    "nested-form-panel",
  ]);
  add("nested-panel", "tab-panel", { label: "Details" }, ["details"]);
  add("details", "heading", { content: "Nested editable content", level: 2 });
  add("nested-form-panel", "tab-panel", { label: "Nested form" }, [
    "nested-form",
  ]);
  add("nested-form", "host-demo-form");
  add("enquire", "tab-panel", { label: "Enquire" }, ["form"]);
  add("form", "host-demo-form");
  add("unavailable", "tab-panel", { label: "Unavailable" }, ["missing-form"]);
  add("missing-form", "host-demo-form", { formId: "missing" });
  const galleryDefaults = builder.elements
    .get("gallery-carousel")!
    .defaults() as { items: Record<string, unknown>[] };
  const items = galleryDefaults.items.map((item, index) => ({
    ...item,
    source: {
      type: "resource",
      reference: { kind: "demo-image", value: String(index + 1) },
    },
    destination: index === 2 ? { type: "anchor", elementId: "intro" } : null,
    width: 600,
    height: [400, 800, 600][index],
  }));
  add("grid", "gallery-carousel", {
    layout: "grid",
    items,
    lightbox: true,
    aspectRatio: "4 / 3",
  });
  // Exercise a version 2 Document saved before the responsive controls existed.
  const gridProps = { ...elements.grid!.props };
  for (const key of [
    "columns",
    "tabletColumns",
    "mobileColumns",
    "gap",
    "radius",
  ])
    delete gridProps[key];
  elements.grid = { ...elements.grid!, props: gridProps };
  add("masonry", "gallery-carousel", {
    layout: "masonry",
    items,
    lightbox: true,
  });
  add("faq-one", "accordion");
  add("faq-two", "accordion");
  add("rich-faq", "content-accordion", {}, ["rich-overview", "rich-enquire"]);
  add(
    "rich-overview",
    "accordion-panel",
    {
      question: "What can an answer contain?",
      defaultOpen: true,
    },
    ["rich-answer", "nested-faq"],
  );
  add("rich-answer", "heading", {
    content: "Ordinary editable Elements",
    level: 2,
  });
  add("nested-faq", "content-accordion", {}, ["nested-answer"]);
  add("nested-answer", "accordion-panel", { question: "Can answers nest?" }, [
    "nested-answer-copy",
  ]);
  add("nested-answer-copy", "rich-text");
  add(
    "rich-enquire",
    "accordion-panel",
    { question: "Can I send an enquiry?" },
    ["accordion-form"],
  );
  add("accordion-form", "host-demo-form", { label: "Accordion enquiry" });
  add("multiple-faq", "content-accordion", { allowMultiple: true }, [
    "multiple-first",
    "multiple-second",
  ]);
  add(
    "multiple-first",
    "accordion-panel",
    { question: "First independent answer", defaultOpen: true },
    ["multiple-copy"],
  );
  add("multiple-copy", "rich-text");
  add(
    "multiple-second",
    "accordion-panel",
    { question: "Second independent answer", defaultOpen: true },
    ["accordion-missing"],
  );
  add("accordion-missing", "host-demo-form", { formId: "missing" });
  add("text-tabs", "tabs");
  elements[base.rootId] = {
    ...base.elements[base.rootId]!,
    children: [
      "header",
      "intro",
      "tabs",
      "grid",
      "masonry",
      "faq-one",
      "faq-two",
      "rich-faq",
      "multiple-faq",
      "text-tabs",
    ],
    styles: { desktop: { normal: { minHeight: "200vh", padding: "16px" } } },
  };
  for (const id of ["intro", "tabs", "grid"])
    elements[id] = {
      ...elements[id]!,
      styles: { desktop: { normal: { scrollMarginTop: "160px" } } },
    };
  const document = { ...base, elements };
  const result = builder.documents.validate(document);
  if (!result.valid) throw result.error;
  return document;
}

const panelActions = defineEditorContribution({
  id: "example.panel-actions",
  kind: "toolbarAction",
  label: "Panel examples",
  render: ({ context }) => (
    <>
      <button onClick={() => context.select("nested-form")}>
        Reveal nested form
      </button>
      <button onClick={() => context.select("accordion-form")}>
        Reveal accordion form
      </button>
      <button
        onClick={() =>
          context.dispatch({ type: "duplicate", elementId: "rich-enquire" })
        }
      >
        Duplicate accordion answer
      </button>
      <button
        onClick={() =>
          context.dispatch({ type: "duplicate", elementId: "enquire" })
        }
      >
        Duplicate enquiry panel
      </button>
    </>
  ),
});
const panelPreset = defineEditorPreset({
  ...standardEditorPreset,
  id: "example.panels",
  placements: standardEditorPreset.placements.map((placement) =>
    placement.slot === "toolbar.leading"
      ? {
          ...placement,
          contributionIds: [...placement.contributionIds, panelActions.id],
        }
      : placement,
  ),
});

export function ModularContentExample() {
  const [document, setDocument] = useState(capabilityDocument);
  const [mode, setMode] = useState<"edit" | "preview" | "published">(
    "published",
  );
  const [resources, setResources] = useState<PreparedResources>();
  useEffect(() => {
    const abort = new AbortController();
    void resolveDocumentResources(capabilityBuilder, document, {
      signal: abort.signal,
      scope: { example: "modular-content" },
    }).then((value) => {
      if (!abort.signal.aborted) setResources(value);
    });
    return () => abort.abort();
  }, [document]);
  const props = {
    builder: capabilityBuilder,
    document,
    elementRenderers: [demoFormRenderer],
    ...(resources ? { resources } : {}),
  };
  return (
    <>
      <nav aria-label="Example modes">
        <label>
          Mobile menu presentation{" "}
          <select
            value={String(document.elements.nav!.props.presentation)}
            onChange={(event) =>
              setDocument(
                capabilityBuilder.editor.dispatch(document, {
                  type: "update-props",
                  elementId: "nav",
                  patch: { presentation: event.currentTarget.value },
                }).document,
              )
            }
          >
            <option value="dropdown">Dropdown</option>
            <option value="fullscreen">Fullscreen</option>
          </select>
        </label>
        {(["edit", "preview", "published"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
          >
            {value}
          </button>
        ))}
      </nav>
      {mode === "edit" ? (
        <PagebldrEditor
          {...props}
          contributions={[panelActions]}
          preset={panelPreset}
          onChange={({ document: next }) => setDocument(next)}
        />
      ) : (
        <div>
          <PagebldrRuntimeInteractions />
          <PagebldrRenderer {...props} mode={mode} />
        </div>
      )}
    </>
  );
}
