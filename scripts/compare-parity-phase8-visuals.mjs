// Compare candidate packed-browser captures without silently updating baselines.
import assert from "node:assert/strict";
import console from "node:console";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const [consumer, baseline, candidate, evidence, recheck] =
  process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { PNG } = require("pngjs");
const { default: pixelmatch } = await import(
  pathToFileURL(require.resolve("pixelmatch")).href
);
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const files = (await readdir(baseline)).filter(
  (file) => file.endsWith(".png") && !file.startsWith("failure-"),
);
assert(files.length > 0, "Baseline must contain captures.");
const results = [];
for (const file of files) {
  const before = PNG.sync.read(await readFile(join(baseline, file)));
  const source =
    recheck && existsSync(join(recheck, file))
      ? join(recheck, file)
      : join(candidate, file);
  const after = PNG.sync.read(await readFile(source));
  assert.equal(after.width, before.width, `${file} width`);
  assert.equal(after.height, before.height, `${file} height`);
  const diff = new PNG({ width: before.width, height: before.height });
  const changed = pixelmatch(
    before.data,
    after.data,
    diff.data,
    before.width,
    before.height,
    { threshold: 0.15 },
  );
  const ratio = changed / (before.width * before.height);
  const status = ratio <= 0.002 ? "pass" : "fail";
  results.push({ file, source, changed, ratio, status });
  if (status === "fail")
    await writeFile(join(output, file), PNG.sync.write(diff));
  else await rm(join(output, file), { force: true });
  console.log(
    `${status.toUpperCase()} ${file}: ${(ratio * 100).toFixed(3)}% changed`,
  );
}
await writeFile(
  join(output, "results.json"),
  `${JSON.stringify({ baseline, candidate, threshold: 0.15, maximumChangedRatio: 0.002, results }, null, 2)}\n`,
);
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
