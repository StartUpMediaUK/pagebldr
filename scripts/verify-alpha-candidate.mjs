import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import process from "node:process";
import { assertAlphaRelease } from "./release-contract.mjs";

const [releaseFile, expectedVersion] = process.argv.slice(2);
if (!releaseFile || !expectedVersion)
  throw new Error("A release manifest and expected version are required.");
const release = JSON.parse(readFileSync(releaseFile, "utf8"));
assert.equal(release.name, "@startupmedia/pagebldr");
assert.equal(release.version, expectedVersion);
assert.equal(release.tag, "alpha");
assert.match(release.sha256, /^[a-f0-9]{64}$/u);
assert.equal(release.archive, basename(release.archive));
assert.deepEqual(
  readdirSync(dirname(releaseFile)).filter((file) => file.endsWith(".tgz")),
  [release.archive],
);
const archive = join(dirname(releaseFile), release.archive);
assert.equal(
  createHash("sha256").update(readFileSync(archive)).digest("hex"),
  release.sha256,
  "Candidate checksum mismatch.",
);
const manifest = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "package/package.json"], {
    encoding: "utf8",
  }),
);
assertAlphaRelease(manifest, expectedVersion);
process.stdout.write(
  `Verified ${manifest.name}@${manifest.version}, tag alpha, SHA-256 ${release.sha256}.\n`,
);
