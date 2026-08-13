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
      "typescript@5.9.3",
      "@types/react@19.2.18",
      "@types/react-dom@19.2.4",
    ],
    {
      cwd: consumerDirectory,
      env: cleanEnvironment,
      stdio: "inherit",
    },
  );
  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        exactOptionalPropertyTypes: true,
        jsx: "react-jsx",
        lib: ["DOM", "ES2022"],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2022",
      },
      include: ["*.ts", "*.tsx"],
    }),
  );
  writeFileSync(
    join(consumerDirectory, "vite-consumer.tsx"),
    `import { createPagebldr } from "pagebldr";
import { PagebldrEditor, PagebldrRenderer } from "pagebldr/react";

const builder = createPagebldr({ namespace: "vite-app" });
const document = builder.documents.create({ id: "home", title: "Home" });
export const editor = <PagebldrEditor builder={builder} document={document} onChange={() => undefined} />;
export const page = <PagebldrRenderer builder={builder} document={document} />;
`,
  );
  writeFileSync(
    join(consumerDirectory, "next-consumer.ts"),
    `import { createPagebldr } from "pagebldr";
import { memoryAdapter } from "pagebldr/adapters/memory";
import { createPagebldrRuntime } from "pagebldr/runtime";
import { createPagebldrServer } from "pagebldr/server";
import { createPagebldrHandler } from "pagebldr/server/next";
import { asPagebldrPrismaClient } from "pagebldr/adapters/prisma";

const builder = createPagebldr({ namespace: "next-app" });
const storage = memoryAdapter();
export const server = createPagebldrServer({ builder, storage, collection: { mode: "multiple" } });
export const runtime = createPagebldrRuntime({ builder, publications: { resolve: async () => null } });
void createPagebldrHandler;
void asPagebldrPrismaClient;
`,
  );
  execFileSync(
    process.execPath,
    [join(consumerDirectory, "node_modules", "typescript", "bin", "tsc")],
    { cwd: consumerDirectory, stdio: "inherit" },
  );
  execFileSync(
    "node",
    [
      "--input-type=module",
      "--eval",
      "await Promise.all([import('pagebldr'), import('pagebldr/react'), import('pagebldr/server'), import('pagebldr/server/next'), import('pagebldr/runtime'), import('pagebldr/adapters/memory'), import('pagebldr/adapters/prisma')])",
    ],
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
  const reactBundle = readFileSync(
    join(consumerDirectory, "node_modules", "pagebldr", "dist", "react.js"),
    "utf8",
  );
  if (!/from ["']react["']/u.test(reactBundle)) {
    throw new Error("React must remain external in the published bundle.");
  }
  const packageCss = readFileSync(
    join(consumerDirectory, "node_modules", "pagebldr", "dist", "styles.css"),
    "utf8",
  );
  if (!packageCss.includes("--pagebldr-focus")) {
    throw new Error(
      "The packed package must contain the documented theme CSS.",
    );
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
