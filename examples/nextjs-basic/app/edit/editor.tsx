"use client";

import { useState } from "react";

import type { PageDocument } from "@startupmedia/pagebldr";
import { PagebldrEditor } from "@startupmedia/pagebldr/react";

import { builder, publishedDocument } from "../../lib/builder";

export function Editor() {
  const [document, setDocument] = useState<PageDocument>(publishedDocument);
  return (
    <PagebldrEditor
      builder={builder}
      document={document}
      onChange={({ document: next }) => setDocument(next)}
      onSave={({ document: next }) => {
        window.localStorage.setItem(
          "pagebldr-next-example",
          JSON.stringify(next),
        );
      }}
    />
  );
}
