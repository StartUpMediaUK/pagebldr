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
import { referenceLibrary, referenceTemplate } from "./reference-library.js";
import { MediaExample } from "./media-example.js";
import {
  createReferenceMediaAdapter,
  createCuratedMediaAdapter,
} from "./reference-media.js";

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

const referenceMedia = createReferenceMediaAdapter();
const builder = createPagebldr({
  namespace: "vite-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
  resources: {
    asset: referenceMedia,
    "curated-media": createCuratedMediaAdapter(),
    // Original geometric illustration, not one of the source Template images.
    "template-media": {
      reference: stringReference,
      resolve: (_reference, context) =>
        referenceMedia.resolve("image-1", context),
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
const librarySource = referenceLibrary(builder);

type ExtensionEditorOptions = Pick<
  PagebldrEditorProps,
  "contributions" | "preset"
>;

function App() {
  const [document, setDocument] = useState<PageDocument>(() =>
    window.location.hash === "#/editor/elements"
      ? allElementsDocument
      : initialDocument,
  );
  const [route, setRoute] = useState(window.location.hash || "#/editor");
  const [extensionOptions, setExtensionOptions] =
    useState<ExtensionEditorOptions | null>(null);

  useEffect(() => {
    if (route.startsWith("#/editor/template/")) {
      const template = referenceTemplate(
        builder,
        route.slice("#/editor/template/".length),
      );
      if (template) setDocument(template);
    }
  }, [route]);
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

  if (route === "#/media") return <MediaExample builder={builder} />;
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
        librarySource={librarySource}
        applicationDestinations={[
          {
            label: "Welcome",
            reference: { kind: "application-link", value: "welcome" },
          },
          {
            label: "Pricing",
            reference: { kind: "application-link", value: "pricing" },
          },
        ]}
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
        resolveApplicationDestination={(reference) =>
          reference.kind === "application-link" &&
          typeof reference.value === "string"
            ? `#/preview/${reference.value}`
            : null
        }
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
