import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type StandardSchemaV1,
} from "pagebldr";
import {
  PagebldrEditor,
  PagebldrRenderer,
  PagebldrRuntimeInteractions,
  type PagebldrEditorProps,
} from "pagebldr/react";
import "pagebldr/styles.css";
import allElementsFixture from "../../../fixtures/parity/all-elements.document.json";
import projectEnquiryFixture from "../../../fixtures/parity/project-enquiry.document.json";

const stringReference: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "vite-example",
    validate: (value) =>
      typeof value === "string"
        ? { value }
        : { issues: [{ message: "Resource reference must be a string." }] },
  },
};

const builder = createPagebldr({
  namespace: "vite-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  resources: {
    asset: {
      reference: stringReference,
      resolve: (id) => (typeof id === "string" ? `/assets/${id}` : null),
      browse: ({ query }) =>
        Promise.resolve({
          items: ["hero.jpg", "product.jpg"].filter((id) =>
            id.includes(query ?? ""),
          ),
        }),
    },
    "application-link": {
      reference: stringReference,
      resolve: (slug) =>
        typeof slug === "string" ? `#/preview/${slug}` : null,
      browse: () => Promise.resolve({ items: ["welcome", "pricing"] }),
    },
  },
});

const initialDocument = builder.documents.migrate(projectEnquiryFixture);
const allElementsDocument = builder.documents.migrate(allElementsFixture);

type ExtensionEditorOptions = Pick<
  PagebldrEditorProps,
  "contributions" | "preset"
>;

function App() {
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [route, setRoute] = useState(window.location.hash || "#/editor");
  const [extensionOptions, setExtensionOptions] =
    useState<ExtensionEditorOptions | null>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/editor");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (route !== "#/extensions" || extensionOptions) return;
    void import("./extensions.js").then(({ extensionEditorOptions }) =>
      setExtensionOptions(extensionEditorOptions),
    );
  }, [extensionOptions, route]);

  if (
    route === "#/preview" ||
    route === "#/published" ||
    route === "#/elements"
  )
    return (
      <div>
        <PagebldrRuntimeInteractions />
        <nav>
          <a href="#/editor">Back to editor</a>
        </nav>
        <PagebldrRenderer
          builder={builder}
          document={route === "#/elements" ? allElementsDocument : document}
          mode={route === "#/published" ? "published" : "preview"}
        />
      </div>
    );

  return (
    <main>
      <nav>
        <a href="#/preview">Preview local document</a>
        {" · "}
        <a href="#/published">Open published rendering</a>
        {" · "}
        <a href="#/elements">Open element gallery</a>
        {" · "}
        <a href={route === "#/extensions" ? "#/editor" : "#/extensions"}>
          {route === "#/extensions"
            ? "Open standard editor"
            : "Open extension examples"}
        </a>
      </nav>
      <PagebldrEditor
        builder={builder}
        document={document}
        mode={route === "#/readonly" ? "readOnly" : "edit"}
        onChange={({ document: nextDocument }) => setDocument(nextDocument)}
        onSave={async ({ document: nextDocument }) => {
          await pause();
          localStorage.setItem(
            "pagebldr-vite-example",
            JSON.stringify(nextDocument),
          );
        }}
        onPublish={async () => pause()}
        {...(route === "#/extensions" && extensionOptions
          ? extensionOptions
          : {})}
      />
    </main>
  );
}

function pause() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 350));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
