import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "pagebldr";
import { PagebldrEditor } from "pagebldr/react";
import "pagebldr/styles.css";

const builder = createPagebldr({
  namespace: "vite-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

const initialDocument = builder.documents.create({
  id: "welcome",
  title: "My first page",
  slug: "welcome",
});

function App() {
  const [document, setDocument] = useState<PageDocument>(initialDocument);

  return (
    <PagebldrEditor
      builder={builder}
      document={document}
      onChange={({ document: nextDocument }) => setDocument(nextDocument)}
      onSave={async ({ document: nextDocument }) => {
        await pause();
        localStorage.setItem(
          "pagebldr-vite-example",
          JSON.stringify(nextDocument),
        );
      }}
      onPublish={async () => pause()}
    />
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
