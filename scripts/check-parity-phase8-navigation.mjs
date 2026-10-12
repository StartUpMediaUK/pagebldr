/* global localStorage, document, fetch, getComputedStyle */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, executablePath, origin = "http://localhost:5187", evidence] =
  process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(
  evidence ??
    "docs/plans/standalone-package/audits/evidence/parity-phase-8/navigation-2026-10-09",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath });
const results = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/#/editor`);
    await page
      .frameLocator("iframe")
      .locator("[data-pagebldr-renderer]")
      .waitFor();
    const save = page.getByRole("button", { name: "Save", exact: true });
    if (await save.count()) await save.click();
    else {
      await page
        .getByRole("button", { name: "More editor actions", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Save draft", exact: true })
        .click();
    }
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved$/u })
      .waitFor();
    const read = () =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((key) =>
          key.startsWith("pagebldr:reference:lifecycle:"),
        );
        return localStorage.getItem(key);
      });
    const before = await read();
    for (const label of ["Close Structure", "Close Add panel"]) {
      const close = page.getByRole("button", { name: label, exact: true });
      if (await close.count()) await close.first().click();
    }
    const workspace = page.getByRole("region", {
      name: "Canvas workspace",
      exact: true,
    });
    await workspace.focus();
    const box = await workspace.boundingBox();
    assert(box);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.keyboard.down("Space");
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x - 100, point.y - 100, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const scroll = await workspace.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
    assert(
      scroll.left > 0 || scroll.top > 0,
      "Space-drag must pan overflowing content.",
    );
    const frame = page.getByTitle("Page canvas", { exact: true });
    await frame.focus();
    await page.keyboard.down("Space");
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x - 25, point.y - 25, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    const framePan = await workspace.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
    assert(
      framePan.left > scroll.left || framePan.top > scroll.top,
      "Space started in the isolated canvas must also pan.",
    );
    await page.keyboard.down("Alt");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Alt");
    const zoom =
      name === "desktop"
        ? page
            .getByRole("button", { name: "Fit canvas width", exact: true })
            .first()
        : page.getByRole("button", { name: "Canvas zoom 110%", exact: true });
    await zoom.filter({ hasText: "110%" }).waitFor();
    if (name === "desktop") await zoom.click();
    else {
      await zoom.click();
      await page
        .getByRole("menuitemcheckbox", { name: "Fit canvas", exact: true })
        .click();
    }
    const fitTransform = await frame.evaluate(
      (element) => element.style.transform,
    );
    await workspace.focus();
    await page.mouse.move(point.x, point.y);
    await page.keyboard.down("Alt");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Alt");
    await page.waitForFunction(
      (previous) =>
        document.querySelector('iframe[title="Page canvas"]').style
          .transform !== previous,
      fitTransform,
    );
    // A subsequent resize must not re-enable Fit after manual wheel zoom.
    const manual = await frame.evaluate((element) => element.style.transform);
    await page.setViewportSize({ width: width - 20, height });
    await page.waitForTimeout(200);
    assert.equal(
      await frame.evaluate((element) => element.style.transform),
      manual,
    );
    assert.equal(
      await read(),
      before,
      "Pan and zoom must not mutate or save the Document.",
    );
    const title = page.getByRole("textbox", {
      name: "Page title",
      exact: true,
    });
    await title.fill("Typing");
    await page.keyboard.press("End");
    await page.keyboard.press("Space");
    await page.keyboard.type("works");
    assert.equal(await title.inputValue(), "Typing works");
    await page.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    const transition = await frame.evaluate(
      (element) => getComputedStyle(element.parentElement).transitionDuration,
    );
    assert(
      transition
        .split(",")
        .every((duration) => Number.parseFloat(duration) <= 0.00001),
      "Reduced motion must eliminate perceptible canvas resizing transitions.",
    );
    await page.screenshot({ path: join(output, `${name}-forced-colors.png`) });
    const axe = await new AxeBuilder({ page })
      .exclude("iframe")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    assert.equal(
      axe.violations.length,
      0,
      JSON.stringify(
        axe.violations.map((issue) => ({
          id: issue.id,
          nodes: issue.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
      ),
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(output, `${name}-forced-colors.png`) });
    results.push({
      name,
      status: "pass",
      scroll,
      manualZoom: manual,
      violations: axe.violations,
      errors,
    });
    console.log(
      `PASS ${name}: pan, wheel zoom, Fit exit, typing and forced-colors/reduced-motion smoke`,
    );
    await context.close();
  }
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        artifact: await (await fetch(`${origin}/packed-artifact.json`)).json(),
        results,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
