// Compare candidate packed-browser captures without silently updating baselines.
import assert from "node:assert/strict";
import console from "node:console";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const [consumer, baseline, candidate, evidence, recheck, regionFile] =
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
const regionsPath =
  regionFile ||
  (process.env.PAGEBLDR_VISUAL_BASELINE
    ? resolve("etc/canvas-visual-regions.json")
    : null);
const regions = regionsPath
  ? JSON.parse(await readFile(regionsPath, "utf8"))
  : null;
for (const file of files) {
  let before = PNG.sync.read(await readFile(join(baseline, file)));
  const source =
    recheck && recheck !== "-" && existsSync(join(recheck, file))
      ? join(recheck, file)
      : join(candidate, file);
  let after = PNG.sync.read(await readFile(source));
  assert.equal(after.width, before.width, `${file} width`);
  assert.equal(after.height, before.height, `${file} height`);
  let targetResult = null;
  const target = regions?.[file]?.target;
  if (target) {
    const { x, y, size } = target;
    assert.ok(
      [x, y, size].every(Number.isInteger) &&
        x >= 0 &&
        y >= 0 &&
        size > 0 &&
        x + size <= before.width &&
        y + size <= before.height,
    );
    const crop = (input) => {
      const output = new PNG({ width: size, height: size });
      PNG.bitblt(input, output, x, y, size, size, 0, 0);
      return output;
    };
    const changed = pixelmatch(
      crop(before).data,
      crop(after).data,
      null,
      size,
      size,
      { threshold: 0.15 },
    );
    targetResult = {
      ...target,
      changed,
      ratio: changed / (size * size),
      maximumChangedRatio: 0.02,
    };
  }
  let region = null;
  if (regions) {
    const height = regions[file]?.height;
    assert.ok(
      Number.isInteger(height) && height > 0 && height <= before.height,
      `${file} requires a valid explicit comparison region.`,
    );
    region = { x: 0, y: 0, width: before.width, height };
    const crop = (input) => {
      const output = new PNG({ width: input.width, height });
      PNG.bitblt(input, output, 0, 0, input.width, height, 0, 0);
      return output;
    };
    before = crop(before);
    after = crop(after);
  }
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
  const status =
    ratio <= 0.002 &&
    (!targetResult || targetResult.ratio <= targetResult.maximumChangedRatio)
      ? "pass"
      : "fail";
  results.push({
    file,
    source,
    region,
    target: targetResult,
    changed,
    ratio,
    status,
  });
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
