// Packed public integration journeys using the repository's Playwright workflow.
// Usage: node scripts/check-parity-phase9-integrations.mjs <consumer> <vite> <next> <evidence>
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, vite, next, evidence] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const browser = await chromium.launch({
  executablePath: process.env.PAGEBLDR_CHROMIUM_EXECUTABLE,
});
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(`${vite}/#/extensions`);
  await page.getByRole("button", { name: "Select page", exact: true }).click();
  await page.getByRole("tab", { name: "Content", exact: true }).waitFor();
  await page.getByText("Draft canvas", { exact: true }).waitFor();
  await page.getByText(/^[0-9]+ Elements$/).waitFor();
  const extensionAccessibility = await new AxeBuilder({ page })
    .exclude("[data-pagebldr-renderer]")
    .exclude("iframe")
    .analyze();
  await page.screenshot({ path: join(output, "contributions.png") });
  results.push({
    journey: "Host Contributions retain selection, context and shell",
    status: "pass",
    violations: extensionAccessibility.violations,
  });

  await page.goto(`${next}/`);
  await page.waitForURL(`${next}/edit`);
  await page
    .getByRole("button", { name: "More editor actions", exact: true })
    .waitFor();
  results.push({
    journey: "Next.js app root opens the editor",
    status: "pass",
  });

  await page.goto(`${next}/welcome`);
  await page
    .getByRole("heading", { name: "Published with pagebldr", exact: true })
    .waitFor();
  assert.equal(await page.title(), "Published with pagebldr");
  await page.getByRole("tab", { name: "Decide", exact: true }).click();
  assert.equal(
    await page
      .getByRole("tab", { name: "Decide", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByText("See the clearest next step.", { exact: true })
    .waitFor({ state: "visible" });
  const publishedAccessibility = await new AxeBuilder({ page }).analyze();
  await page.screenshot({ path: join(output, "next-published.png") });
  results.push({
    journey: "Packed Next.js route resolves metadata and hydrates Tabs",
    status: "pass",
    violations: publishedAccessibility.violations,
  });
  const missing = await page.goto(`${next}/missing`);
  assert.equal(missing.status(), 404);
  results.push({
    journey: "Host-owned missing publication returns 404",
    status: "pass",
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify({ results, errors }, null, 2)}\n`,
  );
  await browser.close();
}
