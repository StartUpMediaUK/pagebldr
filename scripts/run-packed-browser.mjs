// Repeatable installed-package browser gate; does not publish or change workspace dependencies.
/* global fetch, AbortSignal */
import { execFileSync, spawn } from "node:child_process";
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";

const [resultFile, evidenceDirectory, engine = "chromium", suite = "smoke"] =
  process.argv.slice(2);
if (
  !resultFile ||
  !evidenceDirectory ||
  !["chromium", "firefox", "webkit"].includes(engine) ||
  !["full", "smoke"].includes(suite)
)
  throw new Error(
    "Usage: node scripts/run-packed-browser.mjs <packed-result.json> <evidence> [chromium|firefox|webkit] [full|smoke]",
  );
const packed = JSON.parse(readFileSync(resultFile, "utf8"));
const consumer = resolve(packed.consumer);
const output = resolve(evidenceDirectory);
mkdirSync(output, { recursive: true });
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
let installedTooling = false;
try {
  installedTooling =
    JSON.parse(
      readFileSync(
        join(consumer, "node_modules/playwright/package.json"),
        "utf8",
      ),
    ).version === "1.63.0" &&
    JSON.parse(
      readFileSync(
        join(consumer, "node_modules/@axe-core/playwright/package.json"),
        "utf8",
      ),
    ).version === "4.13.0";
  if (process.env.PAGEBLDR_VISUAL_BASELINE)
    installedTooling =
      installedTooling &&
      JSON.parse(
        readFileSync(
          join(consumer, "node_modules/pixelmatch/package.json"),
          "utf8",
        ),
      ).version === "7.1.0" &&
      JSON.parse(
        readFileSync(join(consumer, "node_modules/pngjs/package.json"), "utf8"),
      ).version === "7.0.0";
} catch {
  installedTooling = false;
  /* Install into a newly packed consumer. */
}
if (!installedTooling)
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      "--no-save",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "playwright@1.63.0",
      "@axe-core/playwright@4.13.0",
      ...(process.env.PAGEBLDR_VISUAL_BASELINE
        ? ["pixelmatch@7.1.0", "pngjs@7.0.0"]
        : []),
    ],
    { cwd: consumer, stdio: "inherit" },
  );
if (process.env.PAGEBLDR_SKIP_BROWSER_INSTALL !== "1")
  execFileSync(
    process.execPath,
    [
      join(consumer, "node_modules/playwright/cli.js"),
      "install",
      ...(process.env.PAGEBLDR_INSTALL_BROWSER_DEPS === "1"
        ? ["--with-deps"]
        : []),
      engine,
    ],
    {
      cwd: consumer,
      stdio: "inherit",
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: "1" },
    },
  );

const servers = [];
async function availablePort() {
  const server = createServer();
  await new Promise((accept, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", accept),
  );
  const port = server.address().port;
  await new Promise((accept) => server.close(accept));
  return port;
}
async function start(entry, args, cwd, name, readyPath = "/") {
  const port = await availablePort();
  const log = createWriteStream(join(output, `${name}.log`));
  const child = spawn(
    process.execPath,
    [join(consumer, "node_modules", entry), ...args, "--port", String(port)],
    { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  let error;
  child.on("error", (cause) => {
    error = cause;
  });
  child.once("close", () => log.end());
  servers.push(child);
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (error) throw error;
    if (child.exitCode !== null)
      throw new Error(`${name} exited before readiness; inspect ${name}.log.`);
    try {
      if (
        (
          await fetch(`${origin}${readyPath}`, {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      )
        return origin;
    } catch {
      /* Server is still starting. */
    }
    await setTimeout(250);
  }
  throw new Error(`${name} did not become ready.`);
}
function run(script, args, name, env = {}) {
  execFileSync(
    process.execPath,
    [resolve("scripts", script), ...args, join(output, name)],
    { stdio: "inherit", timeout: 900_000, env: { ...process.env, ...env } },
  );
}
try {
  const vite = await start(
    "vite/bin/vite.js",
    ["preview", "--host", "127.0.0.1", "--strictPort"],
    join(consumer, "examples/vite-basic"),
    "vite",
  );
  execFileSync(
    process.execPath,
    [
      resolve("scripts/check-parity-phase8-browser.mjs"),
      consumer,
      vite,
      join(output, "responsive"),
      engine,
      suite,
    ],
    { stdio: "inherit", timeout: 900_000 },
  );
  if (engine === "chromium") {
    run("check-canvas-handle.mjs", [consumer, vite], "pencil");
    if (process.env.PAGEBLDR_VISUAL_BASELINE)
      execFileSync(
        process.execPath,
        [
          resolve("scripts/compare-parity-phase8-visuals.mjs"),
          consumer,
          resolve(process.env.PAGEBLDR_VISUAL_BASELINE),
          join(output, "pencil"),
          join(output, "visual-diff"),
          "-",
          resolve("etc/canvas-visual-regions-fixed-desktop.json"),
        ],
        { stdio: "inherit", timeout: 120_000 },
      );
    run("check-parity-phase8-keyboard.mjs", [consumer, vite], "keyboard");
    run("check-parity-phase8-library.mjs", [consumer, vite], "library");
    if (suite === "full") {
      // Lifecycle runner has an older argument order; keep it explicit.
      const executable =
        process.env.PAGEBLDR_CHROMIUM_EXECUTABLE ||
        createRequire(join(consumer, "package.json"))(
          "playwright",
        ).chromium.executablePath();
      execFileSync(
        process.execPath,
        [
          resolve("scripts/check-parity-phase7-browser.mjs"),
          consumer,
          executable,
          join(output, "lifecycle"),
        ],
        {
          stdio: "inherit",
          timeout: 900_000,
          env: { ...process.env, PAGEBLDR_PHASE7_ORIGIN: vite },
        },
      );
    }
    if (packed.next) {
      const next = await start(
        "next/dist/bin/next",
        ["start", "--hostname", "127.0.0.1"],
        join(consumer, "examples/nextjs-basic"),
        "next",
        "/edit",
      );
      execFileSync(
        process.execPath,
        [
          resolve("scripts/check-parity-phase8-browser.mjs"),
          consumer,
          next,
          join(output, "next-responsive"),
          engine,
          "next",
        ],
        { stdio: "inherit", timeout: 900_000 },
      );
      run(
        "check-parity-phase9-integrations.mjs",
        [consumer, vite, next],
        "integrations",
      );
    }
  }
  process.stdout.write(
    `Packed ${engine} browser gate passed. Evidence: ${output}\n`,
  );
} finally {
  await Promise.all(
    servers.map(async (child) => {
      if (child.exitCode !== null) return;
      child.kill();
      await Promise.race([
        new Promise((accept) => child.once("close", accept)),
        setTimeout(5000),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }),
  );
}
