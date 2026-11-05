// Public editor mouse/touch/keyboard regression; runs against source or packed Hosts.
// Usage: node scripts/check-canvas-handle.mjs <consumer> <origin> <evidence>
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
const browser = await chromium.launch({
  executablePath: process.env.PAGEBLDR_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const results = [],
  errors = [],
  accessibility = [];
page.on("pageerror", (error) => errors.push(error.message));
const frame = () => page.frameLocator("iframe");
const element = (id) => frame().locator(`[data-pagebldr-element="${id}"]`);
const handle = () =>
  frame().getByRole("button", { name: "Edit Heading", exact: true });
async function fresh(route = "editor/elements") {
  await page.goto(`${origin}/#/${route}`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await element(
    route === "editor/elements" ? "all-elements-heading" : "reference-root-2",
  ).waitFor();
}
async function order() {
  return element("all-elements-root").evaluate((root) =>
    [...root.children]
      .map((node) => node.getAttribute("data-pagebldr-element"))
      .filter(Boolean),
  );
}
async function waitOrder(before) {
  await page.waitForFunction(
    (first) =>
      document
        .querySelector("iframe")
        .contentDocument.querySelector(
          '[data-pagebldr-element="all-elements-root"] > [data-pagebldr-element]',
        )
        ?.getAttribute("data-pagebldr-element") === first,
    before[0],
  );
  assert.deepEqual(await order(), before);
}
async function undo(before) {
  await page.keyboard.press("Control+z");
  await waitOrder(before);
}
async function start() {
  await fresh();
  await element("all-elements-heading").click();
  await handle().waitFor({ state: "visible" });
}
async function target() {
  const rect = await element("all-elements-rich-text").boundingBox();
  // Use a visible point near the left edge; fixed Desktop can overflow a narrow shell.
  return { x: rect.x + 24, y: rect.y + rect.height - 2 };
}
async function pressMove(cancel = false) {
  const before = await order();
  const box = await handle().boundingBox();
  const point = await target();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  await frame().locator("[data-pagebldr-drop-target]").waitFor();
  assert.deepEqual(
    await order(),
    before,
    "Dragging does not mutate before release",
  );
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}
async function snap(name) {
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
  const report = await new AxeBuilder({ page })
    .include("iframe")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const control = await new AxeBuilder({ page })
    .include(["iframe", "[data-pagebldr-ui]"])
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  accessibility.push({
    name,
    violations: report.violations,
    control: control.violations,
  });
  assert.deepEqual(control.violations, []);
}
async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    await page.screenshot({
      path: join(output, `failure-${results.length}.png`),
    });
  }
}
try {
  await check("pencil click opens inspector without moving", async () => {
    await start();
    const before = await order();
    await page
      .getByRole("button", { name: "Close Add panel", exact: true })
      .click();
    await handle().click();
    await page
      .getByRole("tab", { name: "Content", exact: true })
      .waitFor({ state: "visible" });
    assert.deepEqual(await order(), before);
    await snap("pencil-inspector");
  });
  await check(
    "mouse drag reorders once and undo/redo preserve IDs",
    async () => {
      await start();
      const before = await order();
      await page
        .getByRole("button", { name: "Close Add panel", exact: true })
        .click();
      await pressMove();
      await waitOrder([before[1], before[0], ...before.slice(2)]);
      assert.equal(
        await page
          .getByRole("tab", { name: "Content", exact: true })
          .isVisible(),
        false,
        "A completed drag does not trigger the edit click",
      );
      await snap("mouse-moved");
      await undo(before);
      await page.keyboard.press("Control+Shift+z");
      await waitOrder([before[1], before[0], ...before.slice(2)]);
      await undo(before);
    },
  );
  await check(
    "Escape cancels and Alt+arrow moves from the pencil",
    async () => {
      await start();
      const before = await order();
      await pressMove(true);
      assert.deepEqual(await order(), before);
      assert.equal(
        await frame().locator("[data-pagebldr-drop-target]").count(),
        0,
      );
      await handle().press("Alt+ArrowDown");
      await waitOrder([before[1], before[0], ...before.slice(2)]);
      await undo(before);
      await handle().press("Enter");
      await page.getByRole("tab", { name: "Content", exact: true }).waitFor();
    },
  );
  await check(
    "zoomed handle retains its compact size and correct placement",
    async () => {
      await start();
      const before = await order();
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
      const box = await handle().boundingBox();
      assert.ok(Math.abs(box.width - 24) < 1 && Math.abs(box.height - 24) < 1);
      const icon = await handle().locator("svg").boundingBox();
      assert.ok(
        Math.abs(icon.width - 12) < 1 && Math.abs(icon.height - 12) < 1,
      );
      await pressMove();
      await waitOrder([before[1], before[0], ...before.slice(2)]);
      await undo(before);
    },
  );
  await check("self drops and locked/root Elements do not move", async () => {
    await start();
    const before = await order();
    const dragWithoutTarget = async (button, point) => {
      const box = await button.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(point.x, point.y, { steps: 12 });
      assert.equal(
        await frame().locator("[data-pagebldr-drop-target]").count(),
        0,
      );
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.deepEqual(await order(), before);
    };
    const self = await element("all-elements-heading").boundingBox();
    await dragWithoutTarget(handle(), {
      x: self.x + 24,
      y: self.y + self.height / 2,
    });
    await page
      .getByRole("tree")
      .getByRole("button", { name: "Actions for Heading", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Lock", exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("iframe")
          .contentDocument.querySelector('button[aria-label="Edit Heading"]')
          ?.style.cursor !== "grab",
    );
    await dragWithoutTarget(handle(), await target());
    await page
      .getByRole("tree")
      .getByRole("button", { name: "All standard Elements", exact: true })
      .click();
    await dragWithoutTarget(
      frame().getByRole("button", {
        name: "Edit All standard Elements",
        exact: true,
      }),
      await target(),
    );
  });
  await check("inline text editing remains available", async () => {
    await start();
    await element("all-elements-heading").dblclick();
    await element("all-elements-heading").fill("Edited after canvas selection");
    await element("all-elements-heading").press("Enter");
    await frame()
      .getByRole("heading", {
        name: "Edited after canvas selection",
        exact: true,
      })
      .waitFor();
  });
  await check("touch drag moves with the same placement policy", async () => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await start();
    const before = await order();
    const close = page
      .getByRole("button", { name: "Close Structure", exact: true })
      .first();
    if (await close.isVisible()) await close.click();
    // Close the inspector overlay before reaching the canvas pencil.
    const closePanel = page.getByRole("button", {
      name: "Close Add panel",
      exact: true,
    });
    if (await closePanel.isVisible()) await closePanel.click();
    const box = await handle().boundingBox(),
      point = await target();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    for (let step = 1; step <= 10; step++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x:
              box.x +
              box.width / 2 +
              ((point.x - box.x - box.width / 2) * step) / 10,
            y:
              box.y +
              box.height / 2 +
              ((point.y - box.y - box.height / 2) * step) / 10,
          },
        ],
      });
    await frame().locator("[data-pagebldr-drop-target]").waitFor();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await waitOrder([before[1], before[0], ...before.slice(2)]);
    await snap("touch-moved");
  });
  await check("preview and read-only hide authoring handles", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await fresh("readonly");
    assert.equal(
      await frame()
        .getByRole("button", { name: /^Edit / })
        .count(),
      0,
    );
    await start();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("button", { name: "Return to editor", exact: true })
      .waitFor();
    assert.equal(
      await frame()
        .getByRole("button", { name: /^Edit / })
        .count(),
      0,
    );
  });
} finally {
  const response = await page.request.get(`${origin}/packed-artifact.json`);
  const artifact =
    response.ok() &&
    response.headers()["content-type"]?.includes("application/json")
      ? await response.json()
      : null;
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
