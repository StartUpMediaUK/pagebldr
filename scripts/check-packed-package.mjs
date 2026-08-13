import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDirectory = join(workspace, "packages", "pagebldr");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "pagebldr-pack-"));
const npmCli = join(
  dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);
const cleanEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !name.toLowerCase().startsWith("npm_config_"),
  ),
);

try {
  const packOutput = execFileSync(
    process.execPath,
    [
      npmCli,
      "pack",
      packageDirectory,
      "--pack-destination",
      temporaryDirectory,
    ],
    {
      cwd: temporaryDirectory,
      encoding: "utf8",
      env: cleanEnvironment,
    },
  );
  const archiveName = packOutput.trim().split(/\r?\n/u).at(-1);
  if (!archiveName)
    throw new Error("pnpm pack did not return an archive path.");

  const archivePath = resolve(temporaryDirectory, archiveName);
  const consumerDirectory = join(temporaryDirectory, "consumer");
  mkdirSync(consumerDirectory, { recursive: true });
  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify({
      name: "pagebldr-pack-consumer",
      private: true,
      type: "module",
    }),
  );
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      archivePath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: consumerDirectory,
      env: cleanEnvironment,
      stdio: "inherit",
    },
  );
  execFileSync(
    "node",
    ["--input-type=module", "--eval", "await import('pagebldr')"],
    { cwd: consumerDirectory, stdio: "inherit" },
  );

  const installedManifest = JSON.parse(
    readFileSync(
      join(consumerDirectory, "node_modules", "pagebldr", "package.json"),
      "utf8",
    ),
  );
  if (installedManifest.private === true) {
    throw new Error("The packed package must not be private.");
  }
  if (installedManifest.name !== "pagebldr") {
    throw new Error("The packed package has the wrong name.");
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
