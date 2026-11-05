// Produce a reviewable local candidate. This script never publishes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { assertAlphaRelease } from "./release-contract.mjs";

const [resultFile, destination, expectedVersion] = process.argv.slice(2);
if (!resultFile || !destination || !expectedVersion)
  throw new Error(
    "Usage: node scripts/prepare-alpha-release.mjs <packed-result.json> <destination> <expected-version>",
  );
const result = JSON.parse(readFileSync(resultFile, "utf8"));
const manifest = JSON.parse(
  readFileSync(
    join(result.consumer, "node_modules/pagebldr/package.json"),
    "utf8",
  ),
);
const tag = assertAlphaRelease(manifest, expectedVersion);
const archive = readFileSync(result.archive);
const sha256 = createHash("sha256").update(archive).digest("hex");
assert.equal(
  sha256,
  result.sha256,
  "The tested archive changed after verification.",
);
const output = resolve(destination);
mkdirSync(output, { recursive: true });
const file = basename(result.archive);
copyFileSync(result.archive, join(output, file));
writeFileSync(
  join(output, "release.json"),
  `${JSON.stringify({ name: manifest.name, version: manifest.version, tag, archive: file, sha256 }, null, 2)}\n`,
);
process.stdout.write(
  `Prepared ${manifest.name}@${manifest.version} for ${tag}: ${sha256}\nNo publication performed.\n`,
);
