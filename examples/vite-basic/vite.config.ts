import type * as CapabilityExample from "./src/modular-content-example.js";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "reference-host-capability-ssr",
      configureServer(server) {
        server.middlewares.use(
          "/capabilities-ssr",
          (_request, response, next) => {
            void (async () => {
              try {
                const { createElement } = await import("react");
                const { renderToString } = await import("react-dom/server");
                const { resolveDocumentResources } =
                  await import("@startupmedia/pagebldr");
                const {
                  CapabilityPage,
                  capabilityBuilder,
                  capabilityDocument,
                } = (await server.ssrLoadModule(
                  "/src/modular-content-example.tsx",
                )) as typeof CapabilityExample;
                const document = capabilityDocument();
                const resources = await resolveDocumentResources(
                  capabilityBuilder,
                  document,
                );
                const markup = renderToString(
                  createElement(CapabilityPage, { document, resources }),
                );
                const data = JSON.stringify({
                  document,
                  resources: [...resources.values],
                }).replace(/</g, "\\u003c");
                const html = `<!doctype html><html lang="en"><head><title>Capability SSR and hydration</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/capabilities-ssr.css"></head><body><div id="capability-hydration-root">${markup}</div><script id="capability-data" type="application/json">${data}</script><script type="module" src="/src/capabilities-hydrate.tsx"></script></body></html>`;
                response.setHeader("Content-Type", "text/html");
                response.end(
                  await server.transformIndexHtml("/capabilities-ssr", html),
                );
              } catch (error) {
                next(error);
              }
            })();
          },
        );
      },
    },
  ],
});
