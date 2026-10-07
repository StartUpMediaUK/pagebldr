import assert from "node:assert/strict";
import console from "node:console";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, executablePath] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://localhost:5173/#/editor/elements");
  await page.reload();
  const canvas = page.frameLocator("iframe");
  await canvas.locator("[data-pagebldr-renderer]").waitFor();
  await page
    .getByRole("tree")
    .getByRole("button", { name: "Heading", exact: true })
    .click();
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  const choice = page.getByLabel("HTML level", { exact: true });
  await choice.focus();
  await choice.press("Enter");
  assert.ok(await page.getByRole("listbox").isVisible());
  const inlineEditors = await canvas
    .locator('[contenteditable="true"]')
    .count();
  await page.getByRole("listbox").press("Escape");
  await page.getByRole("listbox").waitFor({ state: "detached" });
  assert.equal(
    inlineEditors,
    0,
    "Inspector Enter must not activate canvas inline editing",
  );
  assert.deepEqual(
    errors,
    [],
    "Choice Escape must not emit a no-op Document command",
  );
  await page.locator("body").evaluate((body) => {
    body.tabIndex = -1;
    body.focus();
  });
  await page.keyboard.press("Enter");
  await canvas
    .locator('[contenteditable="true"]')
    .waitFor({ state: "visible" });
  await canvas.locator('[contenteditable="true"]').press("Escape");
  await canvas
    .locator('[contenteditable="true"]')
    .waitFor({ state: "detached" });
  assert.deepEqual(
    errors,
    [],
    "Canvas Enter and cancelled inline editing remain valid",
  );
  console.log(
    "PASS inspector Enter/Escape is isolated from canvas inline editing",
  );
} finally {
  await browser.close();
}
