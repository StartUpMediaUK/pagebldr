import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { assertAlphaRelease } from "./release-contract.mjs";

const manifest = JSON.parse(
  readFileSync("packages/pagebldr/package.json", "utf8"),
);
test("alpha release rejects a stable version, wrong identity and stale approval", () => {
  assert.equal(assertAlphaRelease(manifest, manifest.version), "alpha");
  for (const version of [
    "0.1.0",
    "1.0.0-alpha.0",
    "0.1.0-beta.0",
    "0.1.0-alpha.0;latest",
  ])
    assert.throws(() => assertAlphaRelease({ ...manifest, version }, version));
  assert.throws(() => assertAlphaRelease(manifest, "0.9.9-alpha.0"));
  assert.throws(() =>
    assertAlphaRelease({ ...manifest, private: true }, manifest.version),
  );
  assert.throws(() =>
    assertAlphaRelease({ ...manifest, name: "other" }, manifest.version),
  );
});

test("candidate scripts preserve the checked archive and reject tampering", () => {
  const directory = mkdtempSync(join(tmpdir(), "pagebldr-release-test-"));
  try {
    const source = join(directory, "source");
    mkdirSync(join(source, "package"), { recursive: true });
    writeFileSync(
      join(source, "package/package.json"),
      JSON.stringify(manifest),
    );
    const archive = join(directory, "pagebldr-test.tgz");
    execFileSync("tar", ["-czf", archive, "-C", source, "package"]);
    const consumer = join(directory, "consumer");
    mkdirSync(join(consumer, "node_modules/pagebldr"), { recursive: true });
    writeFileSync(
      join(consumer, "node_modules/pagebldr/package.json"),
      JSON.stringify(manifest),
    );
    const packed = join(directory, "packed.json");
    const sha256 = createHash("sha256")
      .update(readFileSync(archive))
      .digest("hex");
    writeFileSync(packed, JSON.stringify({ consumer, archive, sha256 }));
    const output = join(directory, "candidate");
    execFileSync(process.execPath, [
      resolve("scripts/prepare-alpha-release.mjs"),
      packed,
      output,
      manifest.version,
    ]);
    const releaseFile = join(output, "release.json");
    const verify = () =>
      execFileSync(
        process.execPath,
        [
          resolve("scripts/verify-alpha-candidate.mjs"),
          releaseFile,
          manifest.version,
        ],
        { stdio: "pipe" },
      );
    verify();
    const release = JSON.parse(readFileSync(releaseFile, "utf8"));
    writeFileSync(join(output, release.archive), "tampered archive");
    assert.throws(verify);
    assert.equal(
      createHash("sha256").update(readFileSync(archive)).digest("hex"),
      sha256,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
