import { execFileSync } from "node:child_process";
import {
  existsSync,
  cpSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
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
const reactVersion = process.env.PAGEBLDR_REACT_VERSION ?? "19.2.8";
const reactTypes = reactVersion.startsWith("18.")
  ? ["@types/react@18.3.31", "@types/react-dom@18.3.7"]
  : ["@types/react@19.2.18", "@types/react-dom@19.2.4"];

function assertMaximumSize(file, maximumBytes, label) {
  const bytes = statSync(file).size;
  if (bytes > maximumBytes)
    throw new Error(`${label} is ${bytes} bytes; budget is ${maximumBytes}.`);
}

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
  // The complete 24-Element runtime and its source maps raise the intentional
  // package baseline while keeping the archive comfortably below 1.25 MB.
  assertMaximumSize(archivePath, 1_250_000, "Packed archive");
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
      `react@${reactVersion}`,
      `react-dom@${reactVersion}`,
      ...reactTypes,
      "esbuild@0.28.2",
      "jsdom@30.0.1",
      "vite@7.3.1",
      "@vitejs/plugin-react@5.1.4",
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
    join(consumerDirectory, "tree-shake.ts"),
    `import { createPagebldr } from "pagebldr";
export const builder = createPagebldr({ namespace: "tree-shake-check" });
`,
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
import { pagebldrMetadata } from "pagebldr/runtime/next";
import { createPagebldrServer } from "pagebldr/server";
import { createPagebldrHandler } from "pagebldr/server/next";
import { asPagebldrPrismaClient } from "pagebldr/adapters/prisma";

const builder = createPagebldr({ namespace: "next-app" });
const storage = memoryAdapter();
export const server = createPagebldrServer({ builder, storage, collection: { mode: "multiple" } });
export const runtime = createPagebldrRuntime({ builder, publications: { resolve: async () => null } });
void createPagebldrHandler;
void asPagebldrPrismaClient;
void pagebldrMetadata;
`,
  );
  execFileSync(
    process.execPath,
    [join(consumerDirectory, "node_modules", "typescript", "bin", "tsc")],
    { cwd: consumerDirectory, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      join(consumerDirectory, "node_modules", "esbuild", "bin", "esbuild"),
      "tree-shake.ts",
      "--bundle",
      "--format=esm",
      "--minify",
      "--outfile=tree-shake.js",
    ],
    { cwd: consumerDirectory, stdio: "inherit" },
  );
  assertMaximumSize(
    join(consumerDirectory, "tree-shake.js"),
    120_000,
    "Tree-shaken core consumer",
  );
  const treeShakenBundle = readFileSync(
    join(consumerDirectory, "tree-shake.js"),
    "utf8",
  );
  if (treeShakenBundle.includes("react"))
    throw new Error("A core-only consumer must not bundle React.");

  copyFileSync(
    join(workspace, "fixtures", "parity", "all-elements.document.json"),
    join(consumerDirectory, "all-elements.document.json"),
  );
  writeFileSync(
    join(consumerDirectory, "ssr-hydration.mjs"),
    `import React from "react";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { createPagebldr, standardElements, standardStyleCapabilities } from "pagebldr";
import { PagebldrRenderer } from "pagebldr/react/server";

const builder = createPagebldr({
  namespace: "hydration-check",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const document = builder.documents.migrate(
  JSON.parse(readFileSync(new URL("./all-elements.document.json", import.meta.url), "utf8")),
);
const element = React.createElement(PagebldrRenderer, { builder, document });
const markup = renderToString(element);
if (!markup.includes('data-pagebldr-renderer="hydration-check"')) throw new Error("SSR renderer marker missing.");
for (const element of Object.values(document.elements)) {
  if (!markup.includes(\`data-pagebldr-element="\${element.id}"\`)) {
    throw new Error(\`SSR output missing standard Element: \${element.type}\`);
  }
}
const dom = new JSDOM(\`<!doctype html><div id="root">\${markup}</div>\`, { url: "https://example.test" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });
const errors = [];
const root = hydrateRoot(dom.window.document.querySelector("#root"), element, { onRecoverableError: (error) => errors.push(error) });
await new Promise((resolve) => setTimeout(resolve, 20));
root.unmount();
if (errors.length > 0) throw errors[0];
`,
  );
  execFileSync(process.execPath, ["ssr-hydration.mjs"], {
    cwd: consumerDirectory,
    stdio: "inherit",
  });
  execFileSync(
    "node",
    [
      "--input-type=module",
      "--eval",
      "await Promise.all([import('pagebldr'), import('pagebldr/react'), import('pagebldr/server'), import('pagebldr/server/next'), import('pagebldr/runtime'), import('pagebldr/runtime/next'), import('pagebldr/adapters/memory'), import('pagebldr/adapters/prisma')])",
    ],
    { cwd: consumerDirectory, stdio: "inherit" },
  );

  const referenceHostDirectory = join(
    consumerDirectory,
    "examples",
    "vite-basic",
  );
  mkdirSync(referenceHostDirectory, { recursive: true });
  copyFileSync(
    join(workspace, "tsconfig.base.json"),
    join(consumerDirectory, "tsconfig.base.json"),
  );
  for (const file of ["index.html", "tsconfig.json", "vite.config.ts"])
    copyFileSync(
      join(workspace, "examples", "vite-basic", file),
      join(referenceHostDirectory, file),
    );
  cpSync(
    join(workspace, "examples", "vite-basic", "src"),
    join(referenceHostDirectory, "src"),
    { recursive: true },
  );
  const fixtureDirectory = join(consumerDirectory, "fixtures", "parity");
  mkdirSync(fixtureDirectory, { recursive: true });
  copyFileSync(
    join(workspace, "fixtures", "parity", "project-enquiry.document.json"),
    join(fixtureDirectory, "project-enquiry.document.json"),
  );
  copyFileSync(
    join(workspace, "fixtures", "parity", "all-elements.document.json"),
    join(fixtureDirectory, "all-elements.document.json"),
  );
  execFileSync(
    process.execPath,
    [
      join(consumerDirectory, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      referenceHostDirectory,
    ],
    { cwd: consumerDirectory, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      join(consumerDirectory, "node_modules", "vite", "bin", "vite.js"),
      "build",
    ],
    { cwd: referenceHostDirectory, stdio: "inherit" },
  );
  if (!existsSync(join(referenceHostDirectory, "dist", "index.html")))
    throw new Error("The packed Reference Host did not produce a Vite build.");

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
  const installedPackage = join(consumerDirectory, "node_modules", "pagebldr");
  for (const [subpath, target] of Object.entries(installedManifest.exports)) {
    const targets =
      typeof target === "string" ? [target] : Object.values(target);
    for (const relativeTarget of targets) {
      if (!existsSync(join(installedPackage, relativeTarget)))
        throw new Error(`${subpath} points to missing file ${relativeTarget}.`);
    }
  }
  const allowedTopLevel = new Set([
    "LICENSE",
    "README.md",
    "dist",
    "package.json",
    "prisma",
  ]);
  for (const entry of readdirSync(installedPackage)) {
    if (!allowedTopLevel.has(entry))
      throw new Error(`Unexpected packed top-level entry: ${entry}.`);
  }
  const distributionDirectory = join(installedPackage, "dist");
  const distributionFiles = readdirSync(distributionDirectory);
  for (const entry of distributionFiles) {
    if (!/\.(?:css|d\.ts|js|js\.map)$/u.test(entry))
      throw new Error(`Unexpected distribution file: ${entry}.`);
    if (entry.endsWith(".js")) {
      const mapFile = `${entry}.map`;
      if (!distributionFiles.includes(mapFile))
        throw new Error(`${entry} has no source map.`);
      const sourceMap = JSON.parse(
        readFileSync(join(distributionDirectory, mapFile), "utf8"),
      );
      if (!Array.isArray(sourceMap.sourcesContent))
        throw new Error(`${mapFile} does not contain sourcesContent.`);
    }
  }
  const reactBundle = readFileSync(
    join(distributionDirectory, "react.js"),
    "utf8",
  );
  assertMaximumSize(
    join(distributionDirectory, "react.js"),
    650_000,
    "React entry",
  );
  assertMaximumSize(
    join(distributionDirectory, "index.js"),
    240_000,
    "Core entry",
  );
  if (!/from ["']react["']/u.test(reactBundle)) {
    throw new Error("React must remain external in the published bundle.");
  }
  const packageCss = readFileSync(
    join(distributionDirectory, "styles.css"),
    "utf8",
  );
  assertMaximumSize(
    join(distributionDirectory, "styles.css"),
    60_000,
    "Package stylesheet",
  );
  if (!packageCss.includes("--pagebldr-focus")) {
    throw new Error(
      "The packed package must contain the documented theme CSS.",
    );
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
