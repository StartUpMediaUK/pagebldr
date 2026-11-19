import { useId, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createPagebldr,
  defineElement,
  resourceKey,
  standardElements,
  standardStyleCapabilities,
  type StandardSchemaV1,
} from "@pagebldr/core";
import { defineReactElementRenderer, PagebldrRenderer } from "./renderer.js";

const schema: StandardSchemaV1<unknown, { reference: string }> = {
  "~standard": {
    version: 1,
    vendor: "host-test",
    validate: (value) => {
      if (
        value &&
        typeof value === "object" &&
        "reference" in value &&
        typeof value.reference === "string"
      )
        return { value: { reference: value.reference } };
      return { issues: [{ message: "Expected a reference." }] };
    },
  },
};
const form = defineElement({
  type: "host-form",
  version: 1,
  label: "Host form",
  props: schema,
  defaults: () => ({ reference: "enquiry" }),
  childPolicy: { kind: "none" },
  references: (props) => [{ kind: "form", value: props.reference }],
  render: () => ({ tag: "p", children: ["Static unavailable fallback"] }),
});
const renderer = defineReactElementRenderer(
  form,
  function HostForm({ props, context }) {
    const id = useId();
    const [pending, setPending] = useState(false);
    const endpoint = context.resource({ kind: "form", value: props.reference });
    if (context.mode === "edit") return <p>Form placeholder</p>;
    if (!endpoint) return <p role="status">Unavailable</p>;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
        }}
      >
        <label htmlFor={id}>Email</label>
        <input id={id} type="email" />
        <button disabled={pending}>Send</button>
      </form>
    );
  },
);
const builder = createPagebldr({
  namespace: "host-test",
  elements: [...standardElements, form],
  styleCapabilities: standardStyleCapabilities,
});
const base = builder.documents.create({ id: "host-page" });
const document = {
  ...base,
  elements: {
    root: { ...base.elements.root!, children: ["form"] },
    form: {
      ...base.elements.root!,
      id: "form",
      type: "host-form",
      props: form.defaults(),
    },
  },
};

describe("public React Element registration", () => {
  it("renders hook-based Host components during SSR using prepared Resources", () => {
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        elementRenderers={[renderer]}
        resources={{
          values: new Map([
            [resourceKey({ kind: "form", value: "enquiry" }), "/host-service"],
          ]),
        }}
      />,
    );
    expect(html).toContain("<form>");
    expect(html).toContain("Email");
    expect(html).toContain('data-pagebldr-element="form"');
    expect(html).not.toContain("Static unavailable fallback");
  });
  it("shares the registration in preview and edit modes with safe missing Resource output", () => {
    expect(
      renderToString(
        <PagebldrRenderer
          builder={builder}
          document={document}
          elementRenderers={[renderer]}
          mode="preview"
        />,
      ),
    ).toContain("Unavailable");
    const html = renderToString(
      <PagebldrRenderer
        builder={builder}
        document={document}
        elementRenderers={[renderer]}
        mode="edit"
      />,
    );
    expect(html).toContain("Form placeholder");
    expect(html).not.toContain("<form");
    expect(
      renderToString(
        <PagebldrRenderer builder={builder} document={document} />,
      ),
    ).toContain("Static unavailable fallback");
  });
  it("refuses duplicate, unregistered or incompatible registrations", () => {
    for (const elementRenderers of [
      [renderer, renderer],
      [{ ...renderer, type: "unknown" }],
      [{ ...renderer, version: 2 }],
    ])
      expect(() =>
        renderToString(
          <PagebldrRenderer
            builder={builder}
            document={document}
            elementRenderers={elementRenderers}
          />,
        ),
      ).toThrow();
  });
});
