// Installed public-UI regression for the source library action hierarchy.
// Usage: node scripts/check-parity-phase8-library.mjs <consumer> <origin> <evidence>
/* global document, localStorage, sessionStorage */
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
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PAGEBLDR_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(8000);
const results = [],
  accessibility = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const artifact = await (
  await page.request.get(`${origin}/packed-artifact.json`)
).json();
const canvas = () =>
  page.frameLocator("iframe").locator("[data-pagebldr-element]");
async function ids() {
  return canvas().evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-pagebldr-element")),
  );
}
async function undo(before) {
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    (count) =>
      document
        .querySelector("iframe")
        .contentDocument.querySelectorAll("[data-pagebldr-element]").length ===
      count,
    before.length,
  );
  assert.deepEqual(await ids(), before);
}
async function library(tab) {
  const close = page
    .getByRole("button", { name: "Close Structure", exact: true })
    .first();
  if (await close.isVisible()) await close.click();
  const back = page.getByRole("button", {
    name: "Back to Add to page",
    exact: true,
  });
  if (await back.isVisible()) await back.click();
  const target = page.getByRole("tab", { name: tab, exact: true });
  if (!(await target.isVisible()))
    await page
      .getByRole("button", {
        name: /^(Open Add panel|Add to page|Add|Edit selected element)$/,
      })
      .first()
      .click();
  if (await back.isVisible()) await back.click();
  await target.click();
}
async function capture(name) {
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
  const report = await new AxeBuilder({ page })
    .include("[data-pagebldr-library]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  accessibility.push({ name, violations: report.violations });
  assert.equal(report.violations.length, 0, `${name}: library axe violations`);
}
// Reach the target through actual Tab/Shift+Tab input, without programmatic focus.
async function keyboardTo(target) {
  for (let index = 0; index < 300; index++) {
    if (await target.evaluate((node) => node === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${target} with Tab`);
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone-s", 375, 667],
  ]) {
    try {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/#/editor`);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
      await canvas().first().waitFor();
      const editorBox = await page
        .getByRole("region", { name: "Page builder", exact: true })
        .boundingBox();
      assert.equal(editorBox.y, 0, "Editor begins at the top of the viewport");
      assert.equal(editorBox.height, height, "Editor fills the viewport");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollHeight),
        height,
        "No surrounding page scroll",
      );
      const before = await ids();
      await library("Blocks");
      const cards = page.locator('[data-pagebldr-library] [data-slot="card"]');
      assert.equal(await cards.count(), 23);
      const first = cards.first();
      assert.equal(await first.getByRole("button").count(), 1);
      const insert = first.getByRole("button", {
        name: "Insert block",
        exact: true,
      });
      const geometry = await insert.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        parent: node.parentElement.getBoundingClientRect().width,
      }));
      assert.ok(
        Math.abs(geometry.width - (geometry.parent - 48)) < 2,
        "Insert spans the footer content width",
      );
      await capture(`${name}-blocks`);
      await keyboardTo(insert);
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        (count) =>
          document
            .querySelector("iframe")
            .contentDocument.querySelectorAll("[data-pagebldr-element]")
            .length > count,
        before.length,
      );
      await undo(before);
      await library("Templates");
      const template = page.locator(
        '[data-library-key="growth-bottleneck-audit"]',
      );
      assert.equal(
        await template
          .getByRole("button", { name: "Apply template", exact: true })
          .count(),
        0,
      );
      const favourite = template.getByRole("button", {
        name: "Favourite Growth Bottleneck Audit",
        exact: true,
      });
      await keyboardTo(favourite);
      await page.keyboard.press("Space");
      assert.equal(await favourite.getAttribute("aria-pressed"), "true");
      const category = page.getByRole("combobox", {
        name: "Library category",
        exact: true,
      });
      await keyboardTo(category);
      await page.keyboard.press("Enter");
      await page.getByRole("listbox").waitFor();
      await page.waitForTimeout(100);
      await page.keyboard.press("Home");
      await page.waitForTimeout(30);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(30);
      await page.keyboard.press("Enter");
      assert.equal(await category.getAttribute("data-value"), "favourites");
      assert.equal(
        await page
          .locator('[data-pagebldr-library] [data-slot="card"]')
          .count(),
        1,
      );
      await capture(`${name}-template-favourite`);
      const preview = template.getByRole("button", {
        name: "Preview Growth Bottleneck Audit",
        exact: true,
      });
      await keyboardTo(preview);
      await page.keyboard.press("Enter");
      await page
        .getByRole("dialog")
        .locator("[data-pagebldr-renderer]")
        .waitFor();
      assert.deepEqual(
        await ids(),
        before,
        "Preview leaves the canvas unchanged",
      );
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        await preview.evaluate((node) => node === document.activeElement),
        true,
        "Preview restores opener focus",
      );
      await page.keyboard.press("Enter");
      const apply = page
        .getByRole("dialog")
        .getByRole("button", { name: "Apply template", exact: true });
      await keyboardTo(apply);
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForFunction((previous) => {
        const nodes = document
          .querySelector("iframe")
          .contentDocument.querySelectorAll("[data-pagebldr-element]");
        return (
          JSON.stringify(
            [...nodes].map((node) =>
              node.getAttribute("data-pagebldr-element"),
            ),
          ) !== JSON.stringify(previous)
        );
      }, before);
      assert.notDeepEqual(await ids(), before);
      await undo(before);
      await library("Templates");
      assert.equal(
        await category.getAttribute("data-value"),
        "favourites",
        "Filter survives inspector return",
      );
      results.push({ name, status: "pass" });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, status: "fail", error: error.message });
      console.log(`FAIL ${name}: ${error.message}`);
      await page.screenshot({ path: join(output, `${name}-failure.png`) });
    }
  }
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/#/editor/elements`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await canvas().first().waitFor();
    const tree = page.getByRole("tree");
    await tree.getByRole("button", { name: "Image", exact: true }).click();
    await tree
      .getByRole("button", { name: "Actions for Image", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Save as Block", exact: true })
      .click();
    // Wait for the dialog's default-name effect before replacing its value.
    await page.waitForFunction(
      () => document.querySelector('input[value="Image"]') !== null,
    );
    await page
      .getByRole("textbox", { name: "Block name", exact: true })
      .fill("Library saved image");
    await page.getByRole("button", { name: "Save Block", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const before = await ids();
    await library("Blocks");
    await page
      .getByRole("textbox", { name: "Search library", exact: true })
      .fill("Library saved image");
    const row = page
      .locator("[data-library-key]")
      .filter({ hasText: "Library saved image" });
    assert.equal(await row.getAttribute("draggable"), "true");
    await capture("saved-block-row");
    await keyboardTo(
      row.getByRole("button", { name: "Library saved image", exact: true }),
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (count) =>
        document
          .querySelector("iframe")
          .contentDocument.querySelectorAll("[data-pagebldr-element]")
          .length ===
        count + 1,
      before.length,
    );
    await undo(before);
    await library("Blocks");
    await row
      .getByRole("button", {
        name: "Delete saved block Library saved image",
        exact: true,
      })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.equal(await row.count(), 1);
    await row
      .getByRole("button", {
        name: "Delete saved block Library saved image",
        exact: true,
      })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete entry", exact: true })
      .click();
    await row.waitFor({ state: "hidden" });
    assert.deepEqual(
      await ids(),
      before,
      "Deleting a saved Block preserves authored Elements",
    );
    await page.goto(`${origin}/#/readonly`);
    await page.reload();
    await canvas().first().waitFor();
    await library("Blocks");
    await page
      .getByRole("textbox", { name: "Search library", exact: true })
      .fill("");
    assert.equal(
      await page
        .getByRole("button", { name: "Insert block", exact: true })
        .first()
        .isDisabled(),
      true,
    );
    await library("Templates");
    await page
      .getByRole("button", {
        name: "Preview Growth Bottleneck Audit",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Apply template", exact: true })
        .isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await capture("readonly-templates-preferences");
    results.push({ name: "saved-block", status: "pass" });
    console.log("PASS saved-block");
  } catch (error) {
    results.push({ name: "saved-block", status: "fail", error: error.message });
    console.log(`FAIL saved-block: ${error.message}`);
    await page.screenshot({ path: join(output, "saved-block-failure.png") });
  }
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      { artifact, browser: browser.version(), results, errors },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(output, "accessibility.json"),
    JSON.stringify(accessibility, null, 2) + "\n",
  );
  await browser.close();
}
if (errors.length || results.some((result) => result.status !== "pass"))
  process.exitCode = 1;
