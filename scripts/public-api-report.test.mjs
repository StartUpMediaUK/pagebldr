import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { publicApiReport } from "./public-api-report.mjs";

test("public declaration report detects member changes and resolves re-exports", () => {
  const directory = mkdtempSync(join(tmpdir(), "pagebldr-api-test-"));
  try {
    const entry = join(directory, "index.d.ts");
    const model = join(directory, "model.d.ts");
    writeFileSync(
      entry,
      'export type { Model as PublicModel } from "./model.js";\n',
    );
    writeFileSync(
      model,
      "export interface Model { readonly title: string }\ninterface Private { value: number }\n",
    );
    const before = publicApiReport({ ".": entry });
    assert.deepEqual(Object.keys(before["."]), ["PublicModel"]);
    writeFileSync(
      model,
      "export interface Model { readonly title: string; readonly slug: string }\n",
    );
    assert.notDeepEqual(publicApiReport({ ".": entry }), before);
    writeFileSync(
      model,
      'export interface Model { readonly title: "two  spaces" }\n',
    );
    const spaced = publicApiReport({ ".": entry });
    writeFileSync(
      model,
      'export interface Model { readonly title: "two spaces" }\n',
    );
    assert.notDeepEqual(publicApiReport({ ".": entry }), spaced);
    writeFileSync(entry, "export {};\n");
    assert.deepEqual(publicApiReport({ ".": entry })["."], {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
