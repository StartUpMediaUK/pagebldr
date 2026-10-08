import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTemplateBoundary } from "./template-boundary.mjs";

function withPackage(callback) {
  const directory = mkdtempSync(join(tmpdir(), "pagebldr-template-boundary-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("permits generic Template APIs and the neutral Block catalogue", () =>
  withPackage((directory) => {
    writeFileSync(
      join(directory, "react.js"),
      "export const TemplatePicker = 'Host templates'; const block = 'simple-header';",
    );
    assert.doesNotThrow(() => assertTemplateBoundary(directory));
  }));
for (const [file, content] of [
  ["library.js", "growth-bottleneck-audit"],
  [
    "react.js.map",
    JSON.stringify({ sourcesContent: ["project-fit-enquiry-hero.jpg"] }),
  ],
  [
    "react.js.map",
    JSON.stringify({ sources: ["../../../fixtures/library/index.json"] }),
  ],
  ["source.jpg", "binary placeholder"],
])
  test(`rejects private Template data or images in ${file}: ${content}`, () =>
    withPackage((directory) => {
      writeFileSync(join(directory, file), content);
      assert.throws(
        () => assertTemplateBoundary(directory),
        /must not ship|Private test Template/u,
      );
    }));
