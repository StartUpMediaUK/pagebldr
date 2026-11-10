import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import console from "node:console";
import {
  existsSync,
  cpSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { assertTemplateBoundary } from "./template-boundary.mjs";

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDirectory = join(workspace, "packages", "pagebldr");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "pagebldr-pack-"));
// Opt-in browser acceptance mode; normal CI continues to clean up its consumer.
const keepReferenceHost =
  process.env.PAGEBLDR_KEEP_PACKED_REFERENCE_HOST === "1";
const checkNextHost = process.env.PAGEBLDR_CHECK_PACKED_NEXT === "1";
const npmCli =
  process.platform === "win32"
    ? join(
        dirname(process.execPath),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      )
    : realpathSync(join(dirname(process.execPath), "npm"));
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
  if (keepReferenceHost) console.log(`${label}: ${bytes} bytes`);
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
      // Verify the preceding build without rebuilding under the consumer's
      // runtime (which can be older than the development toolchain).
      "--ignore-scripts",
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
  // Check the packed file list before consumer installation or browser setup.
  const archiveFiles = execFileSync("tar", ["-tf", archiveName], {
    cwd: temporaryDirectory,
    encoding: "utf8",
  });
  if (
    /fixtures\/|public\/templates\/|\.(?:png|jpe?g|webp|gif|avif|svg)$/imu.test(
      archiveFiles,
    )
  )
    throw new Error(
      "The package archive must not contain test fixtures or image assets.",
    );
  // Phase 6 adds the neutral 23-Block library subpath and shared library/media
  // UI (~1.61 MB packed including maps); private Template fixtures are excluded.
  // Phase 7 adds the lifecycle/History/recovery UI, publication validation and
  // transactional Audit outbox. Measured checkpoint: 1,678,118 bytes; retain
  // an explicit ceiling for these required features, not an unbounded waiver.
  // Patched Zod 4 increases the complete embedded source maps. Measured:
  // 2,318,192 bytes, with core and React JavaScript still below their ceilings.
  assertMaximumSize(archivePath, 2_400_000, "Packed archive");
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
      "jsdom@27.4.0",
      "vite@7.3.7",
      "@vitejs/plugin-react@5.1.4",
      ...(checkNextHost ? ["next@16.4.1", "@types/node@22.19.7"] : []),
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
    `import { createPagebldr } from "@startupmedia/pagebldr";
export const builder = createPagebldr({ namespace: "tree-shake-check" });
`,
  );
  writeFileSync(
    join(consumerDirectory, "vite-consumer.tsx"),
    `import { createPagebldr } from "@startupmedia/pagebldr";
import { PagebldrEditor, PagebldrRenderer, defineEditorContribution, defineEditorPreset, standardEditorPreset, usePagebldrEditor } from "@startupmedia/pagebldr/react";
import { standardBlocks } from "@startupmedia/pagebldr/library";
void standardBlocks;

const builder = createPagebldr({ namespace: "vite-app" });
const document = builder.documents.create({ id: "home", title: "Home" });
export const editor = <PagebldrEditor builder={builder} document={document} onChange={() => undefined} />;
export const page = <PagebldrRenderer builder={builder} document={document} />;
const contribution = defineEditorContribution({
  id: "consumer.document-status", kind: "statusItem", label: "Document status",
  render: ({ context }) => {
    const editor = usePagebldrEditor();
    return <span>{editor.document.id}: {context.selectedId}</span>;
  },
});
const preset = defineEditorPreset({
  id: "consumer.standard", label: "Consumer standard",
  placements: standardEditorPreset.placements.map((placement) => ({
    ...placement,
    contributionIds: placement.slot === "status" ? [...placement.contributionIds, contribution.id] : placement.contributionIds,
  })),
});
export const extendedEditor = <PagebldrEditor builder={builder} document={document} onChange={() => undefined} contributions={[contribution]} preset={preset} />;
// @ts-expect-error Extend through Contributions; arbitrary children cannot replace the editor.
export const unsupportedReplacement = <PagebldrEditor builder={builder} document={document} onChange={() => undefined}><span>Replacement</span></PagebldrEditor>;
`,
  );
  writeFileSync(
    join(consumerDirectory, "next-consumer.ts"),
    `import { createPagebldr } from "@startupmedia/pagebldr";
import { memoryAdapter } from "@startupmedia/pagebldr/adapters/memory";
import { createPagebldrRuntime } from "@startupmedia/pagebldr/runtime";
import { pagebldrMetadata } from "@startupmedia/pagebldr/runtime/next";
import { createPagebldrServer } from "@startupmedia/pagebldr/server";
import { createPagebldrHandler } from "@startupmedia/pagebldr/server/next";
import { asPagebldrPrismaClient } from "@startupmedia/pagebldr/adapters/prisma";

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
    // Patched Zod 4 factory-only consumer: 164,506 bytes (+37,253 bytes).
    170_000,
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
import { createPagebldr, standardElements, standardStyleCapabilities } from "@startupmedia/pagebldr";
import { PagebldrRenderer } from "@startupmedia/pagebldr/react/server";

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
      "await Promise.all([import('@startupmedia/pagebldr'), import('@startupmedia/pagebldr/library'), import('@startupmedia/pagebldr/react'), import('@startupmedia/pagebldr/server'), import('@startupmedia/pagebldr/server/next'), import('@startupmedia/pagebldr/runtime'), import('@startupmedia/pagebldr/runtime/next'), import('@startupmedia/pagebldr/adapters/memory'), import('@startupmedia/pagebldr/adapters/prisma')])",
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
  // Private Host testing material is supplied separately, never from the archive.
  cpSync(
    join(workspace, "fixtures", "library"),
    join(consumerDirectory, "fixtures", "library"),
    { recursive: true },
  );
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

  if (checkNextHost) {
    const nextHostDirectory = join(
      consumerDirectory,
      "examples",
      "nextjs-basic",
    );
    mkdirSync(nextHostDirectory, { recursive: true });
    for (const directory of ["app", "lib"])
      cpSync(
        join(workspace, "examples", "nextjs-basic", directory),
        join(nextHostDirectory, directory),
        { recursive: true },
      );
    for (const file of ["tsconfig.json", "next.config.ts", "next-env.d.ts"])
      copyFileSync(
        join(workspace, "examples", "nextjs-basic", file),
        join(nextHostDirectory, file),
      );
    writeFileSync(
      join(nextHostDirectory, "package.json"),
      JSON.stringify({
        name: "packed-next-host",
        private: true,
        type: "module",
      }),
    );
    execFileSync(
      process.execPath,
      [
        join(consumerDirectory, "node_modules", "next", "dist", "bin", "next"),
        "build",
      ],
      { cwd: nextHostDirectory, stdio: "inherit" },
    );
    console.log(`Packed Next.js Host: ${nextHostDirectory}`);
  }

  const installedManifest = JSON.parse(
    readFileSync(
      join(
        consumerDirectory,
        "node_modules",
        "@startupmedia/pagebldr",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (installedManifest.private === true) {
    throw new Error("The packed package must not be private.");
  }
  if (installedManifest.name !== "@startupmedia/pagebldr") {
    throw new Error("The packed package has the wrong name.");
  }
  if (keepReferenceHost) {
    writeFileSync(
      join(referenceHostDirectory, "dist", "packed-artifact.json"),
      JSON.stringify(
        {
          package: installedManifest.name,
          version: installedManifest.version,
          archive: archiveName,
          sha256: createHash("sha256")
            .update(readFileSync(archivePath))
            .digest("hex"),
          reactVersion,
        },
        null,
        2,
      ),
    );
    console.log(`Packed Reference Host: ${referenceHostDirectory}`);
    if (checkNextHost)
      copyFileSync(
        join(referenceHostDirectory, "dist", "packed-artifact.json"),
        join(
          consumerDirectory,
          "examples",
          "nextjs-basic",
          ".next",
          "packed-artifact.json",
        ),
      );
  }
  const installedPackage = join(
    consumerDirectory,
    "node_modules",
    "@startupmedia/pagebldr",
  );
  assertTemplateBoundary(installedPackage);
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
    "THIRD_PARTY_NOTICES.md",
    "README.md",
    "dist",
    "package.json",
    "prisma",
  ]);
  const colourNotices = readFileSync(
    join(installedPackage, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  );
  for (const dependency of [
    "color 5.0.3",
    "color-convert 3.1.3",
    "color-string 2.1.4",
    "color-name 2.1.1",
  ]) {
    if (!colourNotices.includes(dependency))
      throw new Error(
        `Missing bundled colour dependency notice: ${dependency}.`,
      );
  }
  for (const entry of readdirSync(installedPackage)) {
    if (!allowedTopLevel.has(entry))
      throw new Error(`Unexpected packed top-level entry: ${entry}.`);
  }
  const distributionDirectory = join(installedPackage, "dist");
  const distributionFiles = readdirSync(distributionDirectory);
  for (const entry of distributionFiles) {
    if (!/\.(?:css|d\.ts|d\.ts\.map|js|js\.map)$/u.test(entry))
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
      if (
        !Array.isArray(sourceMap.sources) ||
        sourceMap.sources.length !== sourceMap.sourcesContent.length ||
        sourceMap.sourcesContent.some((source) => typeof source !== "string")
      )
        throw new Error(`${mapFile} has incomplete source contents.`);
    }
    if (entry.endsWith(".d.ts")) {
      const declaration = readFileSync(
        join(distributionDirectory, entry),
        "utf8",
      );
      const map = declaration.match(/sourceMappingURL=(\S+)/u)?.[1];
      if (map && !distributionFiles.includes(map))
        throw new Error(`${entry} advertises a missing declaration map.`);
    }
  }
  const reactBundle = readFileSync(
    join(distributionDirectory, "react.js"),
    "utf8",
  );
  assertMaximumSize(
    join(distributionDirectory, "react.js"),
    1_400_000,
    "React entry",
  );
  assertMaximumSize(
    join(distributionDirectory, "index.js"),
    // Phase 6 adds media contracts and upload queue, not catalogue data, to core.
    260_000,
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
    // Compact floating panels, device popover and shared overlay scrollbars
    // bring compiled CSS to about 87.6 KB; retain a small growth allowance.
    90_000,
    "Package stylesheet",
  );
  if (!packageCss.includes("--pagebldr-focus")) {
    throw new Error(
      "The packed package must contain the documented theme CSS.",
    );
  }
  if (process.env.PAGEBLDR_PACKED_RESULT) {
    if (!keepReferenceHost)
      throw new Error(
        "PAGEBLDR_PACKED_RESULT requires keeping the packed consumer.",
      );
    writeFileSync(
      resolve(process.env.PAGEBLDR_PACKED_RESULT),
      `${JSON.stringify(
        {
          consumer: consumerDirectory,
          archive: archivePath,
          sha256: createHash("sha256")
            .update(readFileSync(archivePath))
            .digest("hex"),
          reactVersion,
          next: checkNextHost,
        },
        null,
        2,
      )}\n`,
    );
  }
} finally {
  if (keepReferenceHost)
    console.log(`Retained packed acceptance workspace: ${temporaryDirectory}`);
  else rmSync(temporaryDirectory, { recursive: true, force: true });
}
