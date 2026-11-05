import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { publicApiReport } from "./public-api-report.mjs";

const baseline = "etc/public-api.json";
const manifest = JSON.parse(
  readFileSync("packages/pagebldr/package.json", "utf8"),
);
const entries = Object.fromEntries(
  Object.entries(manifest.exports)
    .filter(([, target]) => typeof target !== "string")
    .map(([subpath, target]) => [
      subpath,
      resolve("packages/pagebldr", target.types),
    ]),
);
const report = {
  schemaVersion: 1,
  peers: manifest.peerDependencies,
  sideEffects: manifest.sideEffects,
  styles: manifest.exports["./styles.css"],
  modules: publicApiReport(entries),
};
if (process.argv.includes("--write")) {
  mkdirSync(dirname(baseline), { recursive: true });
  writeFileSync(baseline, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Updated ${baseline}; review the interface diff and add a Changeset.\n`,
  );
} else {
  assert.deepEqual(
    report,
    JSON.parse(readFileSync(baseline, "utf8")),
    "Public interface changed. Run pnpm api:update, review the diff and add a Changeset.",
  );
  const sinceIndex = process.argv.indexOf("--since");
  if (sinceIndex !== -1) {
    const base = process.argv[sinceIndex + 1];
    if (!base || base.startsWith("-"))
      throw new Error("--since requires a Git revision.");
    let previous;
    try {
      previous = JSON.parse(
        execFileSync("git", ["show", `${base}:${baseline}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
    } catch {
      /* Initial baseline requires a Changeset too. */
    }
    const packageChanges = execFileSync(
      "git",
      ["diff", "--name-only", base, "--", "packages"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/u)
      .some(
        (file) =>
          /^packages\/[^/]+\/(?:src\/|package\.json$|prisma\/|README\.md$|THIRD_PARTY_NOTICES\.md$|LICENSE$)/u.test(
            file,
          ) && !/\.test\.[cm]?[jt]sx?$/u.test(file),
      );
    if (JSON.stringify(previous) !== JSON.stringify(report) || packageChanges) {
      const changed = execFileSync(
        "git",
        ["diff", "--name-only", base, "--", ".changeset"],
        { encoding: "utf8" },
      );
      const untracked = execFileSync(
        "git",
        ["ls-files", "--others", "--exclude-standard", ".changeset"],
        { encoding: "utf8" },
      );
      const files = [
        ...new Set(`${changed}\n${untracked}`.split(/\r?\n/u)),
      ].filter(
        (file) =>
          /^\.changeset\/[^/]+\.md$/u.test(file) && !file.endsWith("README.md"),
      );
      assert.ok(
        files.some((file) => {
          try {
            return /^"?@startupmedia\/pagebldr"?:\s*(?:patch|minor|major)\s*$/mu.test(
              readFileSync(file, "utf8"),
            );
          } catch {
            return false;
          }
        }),
        "A public interface or shipped package change requires a pagebldr Changeset in this change.",
      );
    }
  }
  process.stdout.write("Public interface matches the reviewed baseline.\n");
}
