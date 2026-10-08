// Keyboard-only entry, selection, commit, Escape and focus restoration in the
// installed Reference Host. No programmatic focus or pointer interactions.
/* global document */
import assert from "node:assert/strict";
import console from "node:console";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
const [consumer, executablePath, evidence] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const origin = process.env.PAGEBLDR_PHASE6_ORIGIN ?? "http://localhost:5177";
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
const results = [];
const focusOrder = [];
async function tabTo(locator) {
  await locator.waitFor();
  for (let step = 0; step < 90; step++) {
    if (await locator.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
    focusOrder.push(
      await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        label: document.activeElement?.getAttribute("aria-label"),
        text: document.activeElement?.textContent?.slice(0, 100),
      })),
    );
  }
  throw new Error(`Keyboard could not reach ${locator}`);
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/#/media`);
    await page.reload();
    const browse = page.getByRole("button", {
      name: "Browse all media",
      exact: true,
    });
    await tabTo(browse);
    await page.keyboard.press("Enter");
    const search = page.getByRole("textbox", {
      name: "Search media",
      exact: true,
    });
    await tabTo(search);
    await page.keyboard.type("Reference image 01");
    await page.waitForTimeout(200);
    const choice = page.getByRole("button", {
      name: "Select Reference image 01.svg",
      exact: true,
    });
    await tabTo(choice);
    await page.keyboard.press("Space");
    await tabTo(page.getByRole("button", { name: "Select (1)", exact: true }));
    await page.screenshot({
      path: join(output, `keyboard-select-${name}.png`),
    });
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.match(
      await page.getByRole("status", { name: "Committed media" }).textContent(),
      /image-1/u,
    );
    assert.equal(
      await browse.evaluate((element) => element === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await browse.evaluate((element) => element === document.activeElement),
      true,
    );
    results.push({ viewport: name, status: "pass" });
    console.log(`PASS keyboard-only picker and focus restoration ${name}`);
  }
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        origin,
        artifact: await (
          await page.request.get(`${origin}/packed-artifact.json`)
        ).json(),
        results,
        focusOrder,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
