// Install the existing Next.js example against a retained packed consumer.
// Never aliases workspace source or adds transpilePackages.
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const consumer = resolve(process.argv[2]);
const npm = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
execFileSync(
  process.execPath,
  [
    npm,
    "install",
    "next@16.3.0",
    "@types/node@22.19.7",
    "playwright@1.63.0",
    "@axe-core/playwright@4.13.0",
    "pixelmatch@7.1.0",
    "pngjs@7.0.0",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  {
    cwd: consumer,
    stdio: "inherit",
  },
);
const target = join(consumer, "examples/nextjs-basic");
mkdirSync(target, { recursive: true });
for (const directory of ["app", "lib"])
  cpSync(resolve("examples/nextjs-basic", directory), join(target, directory), {
    recursive: true,
  });
for (const file of ["tsconfig.json", "next.config.ts", "next-env.d.ts"])
  copyFileSync(resolve("examples/nextjs-basic", file), join(target, file));
execFileSync(
  process.execPath,
  [join(consumer, "node_modules/next/dist/bin/next"), "build"],
  {
    cwd: target,
    stdio: "inherit",
  },
);
copyFileSync(
  join(consumer, "examples/vite-basic/dist/packed-artifact.json"),
  join(target, ".next/packed-artifact.json"),
);
const manifest = JSON.parse(
  readFileSync(join(consumer, "node_modules/pagebldr/package.json"), "utf8"),
);
if (manifest.name !== "pagebldr")
  throw new Error("Expected installed public package.");
