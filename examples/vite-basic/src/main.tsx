import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
  type StandardSchemaV1,
  resolveDocumentResources,
  type PreparedResources,
} from "pagebldr";
import {
  PagebldrEditor,
  createEditorLifecycle,
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
import { referenceLifecycle } from "./reference-lifecycle.js";

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
// Lightweight private fixture keeps browser retention evidence within Web Storage
// limits; the default editor still uses the representative populated Document.
const lifecycleDocument = builder.documents.create({
  id: "lifecycle-retention",
  title: "Lifecycle retention",
  slug: "lifecycle-retention",
});
const librarySource = referenceLibrary(builder);

type ExtensionEditorOptions = Pick<
  PagebldrEditorProps,
  "contributions" | "preset"
>;

function App() {
  const [document, setDocument] = useState<PageDocument>(
    () =>
      referenceLifecycle(
        builder,
        window.location.hash === "#/editor/elements"
          ? allElementsDocument
          : window.location.hash === "#/editor/lifecycle"
            ? lifecycleDocument
            : initialDocument,
      ).loaded.document,
  );
  const [route, setRoute] = useState(window.location.hash || "#/editor");
  const [lifecycle, setLifecycle] = useState<ReturnType<
    typeof createEditorLifecycle
  > | null>(null);
  useEffect(() => {
    const host = referenceLifecycle(builder, document);
    const next = createEditorLifecycle({
      builder,
      ...host,
      onLoadDocument: setDocument,
    });
    setLifecycle(next);
    setDocument(host.loaded.document);
    return () => next.dispose();
  }, [document.id]);
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
        <DocumentView
          document={
            route === "#/elements"
              ? allElementsDocument
              : route === "#/published"
                ? referenceLifecycle(builder, document).published()
                : document
          }
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
        key={document.id}
        {...(lifecycle && lifecycle.exportLocalDocument().id === document.id
          ? { lifecycle }
          : {})}
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

function DocumentView({
  document,
  mode,
}: {
  readonly document: PageDocument | null;
  readonly mode: "published" | "preview";
}) {
  const [resources, setResources] = useState<PreparedResources>();
  useEffect(() => {
    if (!document) return;
    const abort = new AbortController();
    void resolveDocumentResources(builder, document, {
      signal: abort.signal,
    }).then((next) => {
      if (!abort.signal.aborted) setResources(next);
    });
    return () => abort.abort();
  }, [document]);
  return document ? (
    <PagebldrRenderer
      builder={builder}
      document={document}
      mode={mode}
      {...(resources ? { resources } : {})}
    />
  ) : (
    <p>This page is not published.</p>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
