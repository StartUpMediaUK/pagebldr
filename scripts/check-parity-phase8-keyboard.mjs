// Keyboard-only input against the installed Reference Host; no pointer or focus().
/* global document, getComputedStyle, localStorage, sessionStorage, fetch */
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
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["phone", 375, 667],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const input = [];
    const key = async (value) => {
      input.push(value);
      await page.keyboard.press(value);
    };
    const reach = async (locator) => {
      for (let step = 0; step < 250; step++) {
        if (
          await locator.evaluateAll((elements) =>
            elements.some((el) => el === document.activeElement),
          )
        )
          return;
        await key("Tab");
      }
      throw new Error(`Keyboard cannot reach ${locator}`);
    };
    const button = (label) =>
      page.getByRole("button", { name: label, exact: true });
    const activate = async (label) => {
      await reach(button(label));
      await key("Enter");
    };
    const menu = async (label) => {
      await activate("More editor actions");
      await page.getByRole("menu").waitFor();
      await page.waitForTimeout(100);
      const item = page.getByRole("menuitem", { name: label, exact: true });
      for (let step = 0; step < 20; step++) {
        if (await item.evaluate((el) => el === document.activeElement)) {
          await key("Enter");
          return;
        }
        await key("ArrowDown");
        await page.waitForTimeout(30);
      }
      throw new Error(`Keyboard cannot reach menu item ${label}`);
    };
    try {
      await page.goto(`${origin}/#/editor`);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
      await page
        .frameLocator("iframe")
        .locator("[data-pagebldr-renderer]")
        .waitFor();
      await reach(
        page.getByRole("textbox", { name: "Page title", exact: true }),
      );
      await key("Control+a");
      await page.keyboard.type(`Keyboard ${name}`);
      await key("Tab");
      await key("Control+s");
      await page
        .getByRole("status")
        .filter({ hasText: /^Saved$/ })
        .waitFor();
      await activate("Close Structure");
      if (width < 1024) await activate("Open Add panel");
      await activate("Heading");
      await key("Control+i");
      await reach(
        page
          .getByRole("tree")
          .getByRole("button", { name: "Heading", exact: true }),
      );
      await key("Enter");
      await activate("Close Structure");
      const text = page.getByRole("textbox", { name: "Text", exact: true });
      await reach(text);
      await key("Control+a");
      await page.keyboard.type("Keyboard inserted heading");
      await key("Tab");
      await page
        .frameLocator("iframe")
        .getByRole("heading", {
          name: "Keyboard inserted heading",
          exact: true,
        })
        .waitFor();
      assert.match(
        await page
          .frameLocator("iframe")
          .locator("[data-pagebldr-renderer]")
          .textContent(),
        /Keyboard inserted heading/,
      );
      await reach(button("More editor actions"));
      await key("Control+z");
      await page
        .frameLocator("iframe")
        .getByRole("heading", {
          name: "Keyboard inserted heading",
          exact: true,
        })
        .waitFor({ state: "hidden" });
      await key("Control+Shift+z");
      await page
        .frameLocator("iframe")
        .getByRole("heading", {
          name: "Keyboard inserted heading",
          exact: true,
        })
        .waitFor();
      await menu("Page design");
      await page.getByRole("dialog").waitFor();
      await reach(
        page.getByRole("dialog").getByRole("tab", { selected: true }),
      );
      for (let step = 0; step < 4; step++) {
        if (
          await page
            .getByRole("tab", { name: "Variables", exact: true })
            .evaluate((el) => el === document.activeElement)
        )
          break;
        await key("ArrowRight");
      }
      await key("Enter");
      await key("Escape");
      assert.equal(
        await button("More editor actions").evaluate(
          (el) => el === document.activeElement,
        ),
        true,
      );
      await menu("History");
      await key("Escape");
      assert.equal(
        await button("More editor actions").evaluate(
          (el) => el === document.activeElement,
        ),
        true,
      );
      await menu("Preview");
      await key("Escape");
      await button("More editor actions").waitFor();
      await page.emulateMedia({
        reducedMotion: "reduce",
        forcedColors: "active",
      });
      for (const overlay of ["Page design", "History"]) {
        await menu(overlay);
        await page.getByRole("dialog").waitFor();
        const motion = await page.getByRole("dialog").evaluate((el) => ({
          animation: getComputedStyle(el).animationDuration,
          transition: getComputedStyle(el).transitionDuration,
        }));
        assert(
          motion.transition
            .split(",")
            .every((value) => parseFloat(value) === 0),
        );
        assert(
          motion.animation
            .split(",")
            .every((value) => parseFloat(value) <= 0.00001),
        );
        const axe = await new AxeBuilder({ page })
          .exclude("iframe")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        assert.deepEqual(axe.violations, []);
        await page.screenshot({
          path: join(output, `${name}-${overlay.replaceAll(" ", "-")}.png`),
        });
        await key("Escape");
      }
      results.push({ name, status: "pass", input });
      console.log(
        `PASS ${name} keyboard authoring, focus restoration and accessible reduced-motion/forced-colors overlays`,
      );
    } catch (error) {
      results.push({ name, status: "fail", error: error.message, input });
      console.log(`FAIL ${name}: ${error.message}`);
      await page.screenshot({ path: join(output, `${name}-failure.png`) });
      process.exitCode = 1;
    } finally {
      await context.close();
    }
  }
} finally {
  const artifact = await (await fetch(`${origin}/packed-artifact.json`)).json();
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify({ artifact, results }, null, 2)}\n`,
  );
  await browser.close();
}
