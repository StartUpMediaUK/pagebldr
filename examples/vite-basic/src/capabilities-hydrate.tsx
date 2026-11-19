import { hydrateRoot } from "react-dom/client";
import { CapabilityPage } from "./modular-content-example.js";
import "@startupmedia/pagebldr/styles.css";
import type { PageDocument } from "@startupmedia/pagebldr";

const input = JSON.parse(
  document.getElementById("capability-data")!.textContent,
) as {
  document: PageDocument;
  resources: [string, string | null][];
};
hydrateRoot(
  document.getElementById("capability-hydration-root")!,
  <CapabilityPage
    document={input.document}
    resources={{ values: new Map(input.resources) }}
  />,
);
