import assert from "node:assert/strict";

export function assertAlphaRelease(manifest, expectedVersion) {
  assert.equal(
    manifest.name,
    "@startupmedia/pagebldr",
    "Only the pagebldr consumer package is publishable.",
  );
  assert.notEqual(
    manifest.private,
    true,
    "Private workspaces cannot be published.",
  );
  assert.match(
    manifest.version,
    /^0\.\d+\.\d+-alpha\.\d+$/u,
    "The alpha channel requires a 0.x alpha prerelease version.",
  );
  assert.equal(
    manifest.version,
    expectedVersion,
    "The requested version must match the reviewed package.",
  );
  assert.equal(manifest.publishConfig?.access, "public");
  assert.equal(manifest.publishConfig?.provenance, true);
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/StartUpMediaUK/pagebldr.git",
  );
  assert.equal(manifest.exports?.["./styles.css"], "./dist/styles.css");
  return "alpha";
}
