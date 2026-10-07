import assert from "node:assert/strict";
import console from "node:console";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

const directory = resolve(process.argv[2]);
const runs = await Promise.all(
  ["desktop", "tablet", "phone"].map(async (viewport) =>
    JSON.parse(
      await readFile(
        join(directory, viewport, "field-keyboard-matrix.json"),
        "utf8",
      ),
    ),
  ),
);
for (const run of runs) {
  assert.deepEqual(
    run.artifact,
    runs[0].artifact,
    "Viewport runs use the same packed artifact",
  );
  assert.equal(run.browser, runs[0].browser);
}
const combined = {
  artifact: runs[0].artifact,
  browser: runs[0].browser,
  results: runs.flatMap((run) => run.results),
  fields: runs.flatMap((run) => run.fields),
  contracts: runs.flatMap((run) => run.contracts),
  pageErrors: runs.flatMap((run) => run.pageErrors),
};
await writeFile(
  join(directory, "field-keyboard-matrix.json"),
  JSON.stringify(combined, null, 2),
);
assert.equal(
  combined.results.length,
  105,
  "All Elements, branches and Page design run at three viewports",
);
assert.ok(combined.results.every((result) => result.status === "pass"));
assert.deepEqual(combined.pageErrors, []);
console.log(
  `PASS ${combined.results.length} scenarios, ${combined.fields.length} field paths, ${combined.contracts.length} contracts; no page exceptions`,
);
