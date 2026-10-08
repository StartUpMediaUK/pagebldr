import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const fixtureDirectory = fileURLToPath(
  new URL("../fixtures/library/", import.meta.url),
);
const templateKeys = JSON.parse(
  readFileSync(join(fixtureDirectory, "index.json"), "utf8"),
).map(({ key }) => key);
const sourceImages = new Set();
for (const key of templateKeys) {
  const document = readFileSync(
    join(fixtureDirectory, `${key}.document.json`),
    "utf8",
  );
  for (const match of document.matchAll(
    /"value":\s*"([^"\n]+\.(?:png|jpe?g|webp))"/gu,
  ))
    sourceImages.add(match[1]);
}
const excludedMarkers = [
  ...templateKeys,
  ...sourceImages,
  "fixtures/library/",
  "fixtures\\library\\",
  "public/templates/",
];

/** Check actual installed package files, including embedded source-map content. */
export function assertTemplateBoundary(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      assertTemplateBoundary(path);
      continue;
    }
    if (/\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(entry.name)) {
      throw new Error(`Image asset must not ship with the package: ${path}`);
    }
    const content = readFileSync(path, "utf8");
    for (const marker of excludedMarkers) {
      if (content.includes(marker)) {
        throw new Error(
          `Private test Template or source image found in package: ${path} (${marker}).`,
        );
      }
    }
  }
}
