/* global document, localStorage */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, origin, evidence] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const errors = [],
  measurements = [];
page.on("pageerror", (error) => errors.push(error.message));
const panel = page.getByRole("complementary", {
  name: "Add to page",
  exact: true,
});
const handle = page.getByRole("separator", {
  name: "Resize editor panel",
  exact: true,
});
const width = async () => (await panel.boundingBox()).width;
const closeTo = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1, `${actual} != ${expected}`);
async function measure(name) {
  measurements.push({ name, width: await width() });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
}
const read = () =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("pagebldr:reference:lifecycle:"),
    );
    return localStorage.getItem(key);
  });
let failure;
try {
  await page.goto(`${origin}/#/editor`);
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
  await handle.waitFor();
  closeTo(await width(), 340);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /^Saved$/ })
    .waitFor();
  const before = await read();
  await page
    .getByRole("button", { name: "Fit canvas width", exact: true })
    .first()
    .click();
  const fit = page.getByRole("button", {
    name: "Stop fitting canvas",
    exact: true,
  });
  await fit.waitFor();
  const percentage = page.getByRole("button", {
    name: "Fit canvas width",
    exact: true,
  });
  const initialZoom = await percentage.textContent();
  // Reach the separator through actual Tab navigation rather than focus().
  for (let step = 0; step < 150; step++) {
    if (await handle.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press("Tab");
  }
  assert.equal(
    await handle.evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Home");
  await page.waitForTimeout(180);
  closeTo(await width(), 280);
  await measure("keyboard-minimum");
  await page.keyboard.press("ArrowRight");
  closeTo(await width(), 290);
  await page.keyboard.press("Shift+ArrowRight");
  closeTo(await width(), 340);
  await page.keyboard.press("End");
  await page.waitForTimeout(180);
  closeTo(await width(), 430);
  await fit.waitFor();
  assert.notEqual(
    await percentage.textContent(),
    initialZoom,
    "Width-Fit follows panel resizing.",
  );
  await measure("keyboard-maximum");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  const remembered = await width();
  assert.ok(remembered > 280 && remembered < 430);
  await measure("pointer-resize");
  await page
    .getByRole("button", { name: "Close Add panel", exact: true })
    .first()
    .click();
  await handle.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Open Add panel", exact: true })
    .first()
    .click();
  await handle.waitFor();
  closeTo(await width(), remembered);
  await page.setViewportSize({ width: 1023, height: 800 });
  await handle.waitFor({ state: "hidden" });
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
  await measure("compact-overlay");
  assert.ok((await width()) < 400);
  await page.setViewportSize({ width: 1440, height: 900 });
  await handle.waitFor();
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
  await measure("desktop-return");
  closeTo(await width(), remembered);
  assert.equal(
    await read(),
    before,
    "Resizing does not mutate, save or create Revisions.",
  );
  const axe = await new AxeBuilder({ page })
    .exclude("iframe")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map(({ id }) => id),
    [],
  );
  await page.goto(`${origin}/#/readonly`);
  await handle.waitFor();
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
  await measure("read-only");
  assert.deepEqual(errors, []);
  console.log(
    "PASS keyboard/pointer panel resizing, bounds, width-Fit, compact return, no mutations and read-only presentation",
  );
} catch (error) {
  failure = error.message;
  console.log(`FAIL ${failure}`);
  await page.screenshot({ path: join(output, "failure.png") });
} finally {
  const artifact = await (
    await page.request.get(`${origin}/packed-artifact.json`)
  ).json();
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify({ artifact, status: failure ? "fail" : "pass", failure, errors, measurements }, null, 2)}\n`,
  );
  await browser.close();
}
if (failure) process.exitCode = 1;
