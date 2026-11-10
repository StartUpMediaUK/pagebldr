// Packed-artifact visual/accessibility matrix. Browser and UI interactions are
// public; storage flags belong exclusively to the private Reference Host.
/* global document, localStorage, sessionStorage */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [
  consumer,
  origin,
  evidence,
  engine = "chromium",
  suite = "full",
  viewportFilter,
] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const playwright = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const browser = await playwright[engine].launch({
  ...(engine === "chromium" && process.env.PAGEBLDR_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PAGEBLDR_CHROMIUM_EXECUTABLE }
    : {}),
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(8000);
const results = [],
  errors = [],
  accessibility = [],
  libraryPresentation = [];
page.on("pageerror", (error) => errors.push(error.message));
const viewports = [
  ["desktop-l", 1440, 900],
  ["desktop-s", 1280, 800],
  ["tablet-p", 820, 1180],
  ["tablet-l", 1180, 820],
  ["phone", 390, 844],
  ["phone-s", 375, 667],
  ["boundary-1023", 1023, 800],
  ["boundary-1024", 1024, 800],
  ["boundary-767", 767, 800],
  ["boundary-768", 768, 800],
];
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
async function fresh(
  width,
  height,
  route = suite === "next" ? "/edit" : "/#/editor",
) {
  await page.setViewportSize({ width, height });
  await page.goto(
    `${origin}${suite === "full" ? "/?lifecycle-tools=1" : ""}${route}`,
  );
  if (suite !== "next") {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  }
  if (
    route.includes("editor") ||
    route.includes("readonly") ||
    route === "/edit"
  ) {
    await page
      .frameLocator("iframe")
      .locator("[data-pagebldr-renderer]")
      .waitFor();
    const box = await page
      .getByRole("region", { name: "Page builder", exact: true })
      .boundingBox();
    assert.equal(box.y, 0, "Editor starts at the viewport top");
    assert.equal(box.height, height, "Editor fills the viewport height");
  }
}
async function menu(name) {
  await page
    .getByRole("button", { name: "More editor actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
  await page.getByRole("menu").waitFor({ state: "hidden" });
}
async function library(tab) {
  if (
    page.viewportSize().width < 1024 &&
    (await page.getByRole("tree").isVisible())
  )
    await page
      .getByRole("button", { name: "Close Structure", exact: true })
      .first()
      .click();
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
async function select(name) {
  if (!(await page.getByRole("tree").isVisible()))
    await page
      .getByRole("button", { name: /^(Open )?Structure$/ })
      .first()
      .click();
  const tree = page.getByRole("tree");
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await tree.getByRole("button", { name, exact: true }).count()) break;
    const expand = tree.getByRole("button", { name: /^Expand / });
    if (!(await expand.count())) break;
    await expand.first().click();
  }
  await page
    .getByRole("tree")
    .getByRole("button", { name, exact: true })
    .click();
  if (page.viewportSize().width < 1024)
    await page
      .getByRole("button", { name: "Close Structure", exact: true })
      .first()
      .click();
  if (
    page.viewportSize().width < 1024 &&
    !(await page
      .getByRole("complementary", { name: "Element inspector", exact: true })
      .isVisible())
  )
    await page
      .getByRole("button", { name: "Edit selected element", exact: true })
      .click();
}
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  // Capture settled Resources, rather than a frame between image decode/layout.
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame() && frame.url() !== "about:srcdoc") continue;
    await frame.waitForFunction(() =>
      [...document.images].every((image) => image.complete),
    );
  }
  await page.waitForTimeout(180);
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
    caret: "hide",
    mask: [page.locator("time")],
  });
  const full = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  // Keep authored-content findings. The UI gate excludes only rendered pages,
  // never package controls, dialogs, cards, menus or inspector surfaces.
  const ui = await new AxeBuilder({ page })
    .exclude("iframe")
    .exclude("[data-pagebldr-renderer]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  accessibility.push({ name, full: full.violations, editor: ui.violations });
  assert.equal(
    ui.violations.length,
    0,
    JSON.stringify(
      ui.violations.map((issue) => ({
        id: issue.id,
        nodes: issue.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    ),
  );
  if (page.viewportSize().width < 1024) {
    const small = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[data-pagebldr-editor] button, [data-pagebldr-ui] button, [data-pagebldr-ui] [role^="menuitem"]',
        ),
      )
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            !el.closest('[aria-hidden="true"], [inert]') &&
            (box.width < 23.9 || box.height < 23.9)
          );
        })
        .map((el) => ({
          name: el.getAttribute("aria-label") || el.textContent,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
    );
    assert.deepEqual(
      small,
      [],
      `Small compact targets: ${JSON.stringify(small)}`,
    );
  }
}
async function save() {
  const button = page.getByRole("button", { name: "Update", exact: true });
  if (await button.isVisible()) await button.click();
  else await menu("Save draft");
  await page
    .getByRole("status")
    .filter({ hasText: /^Saved$/ })
    .waitFor();
}
try {
  for (const [name, width, height] of viewports) {
    if (viewportFilter && !viewportFilter.split(",").includes(name)) continue;
    await check(`${name} shell boundary and ${suite} authoring`, async () => {
      await fresh(width, height);
      const compact = width < 1024;
      await page
        .getByRole("button", { name: "Add to page", exact: true })
        .last()
        .waitFor({ state: compact ? "visible" : "hidden" });
      if (!compact)
        libraryPresentation.push({
          viewport: name,
          cards: await page
            .locator(
              '[data-pagebldr-library] [role="tabpanel"] button[draggable]',
            )
            .evaluateAll((cards) =>
              cards.map((card) => ({
                label: card.textContent.trim(),
                width: card.getBoundingClientRect().width,
                height: card.getBoundingClientRect().height,
                icon: card.querySelector("svg")?.getAttribute("class"),
              })),
            ),
        });
      await capture(`${name}-VIS-01`);
      const title = page.getByRole("textbox", {
        name: "Page title",
        exact: true,
      });
      await title.fill(`Authoring ${name}`);
      await save();
      if (suite === "next") {
        const saved = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("pagebldr-next-example")),
        );
        assert.equal(saved.title, `Authoring ${name}`);
        await select("Heading");
      } else await select("Page title");
      const text = page.getByRole("textbox", { name: "Text", exact: true });
      await text.fill(`Content ${name}`);
      await text.press("Tab");
      await capture(`${name}-VIS-04`);
      assert.match(
        await page
          .frameLocator("iframe")
          .locator("[data-pagebldr-renderer]")
          .textContent(),
        new RegExp(`Content ${name}`),
      );
      await menu("Preview");
      await capture(`${name}-VIS-10`);
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "More editor actions", exact: true })
        .waitFor();
      if (suite === "next") {
        await page.goto(`${origin}/welcome`);
        await page.getByRole("tab", { name: "Decide", exact: true }).click();
        await page
          .getByRole("tabpanel")
          .filter({ hasText: /clearest next step/ })
          .waitFor();
        assert.match(
          await page.getByRole("tabpanel").textContent(),
          /clearest next step/,
        );
        await capture(`${name}-next-published`);
      }
    });
    if (suite !== "full" || name.startsWith("boundary")) continue;
    await check(
      `${name} libraries, inspectors, design, media and History`,
      async () => {
        await fresh(width, height);
        await library("Blocks");
        await page
          .getByRole("textbox", { name: "Search library", exact: true })
          .fill("hero");
        await capture(`${name}-VIS-02`);
        await page
          .getByRole("textbox", { name: "Search library", exact: true })
          .fill("");
        await library("Templates");
        await capture(`${name}-VIS-03`);
        await page
          .getByRole("button", { name: /^Preview Growth/ })
          .first()
          .click();
        await page
          .getByRole("dialog")
          .locator("[data-pagebldr-renderer]")
          .waitFor();
        await capture(`${name}-template-preview`);
        await page.keyboard.press("Escape");
        await fresh(width, height, "/#/editor/elements");
        await select("Heading");
        await page.getByRole("tab", { name: "Style", exact: true }).click();
        await page
          .getByRole("combobox", { name: "Authored breakpoint", exact: true })
          .click();
        await page.getByRole("option", { name: "Tablet", exact: true }).click();
        await page.getByRole("radio", { name: "Hover", exact: true }).click();
        assert.equal(
          await page
            .getByRole("radio", { name: "Hover", exact: true })
            .getAttribute("aria-checked"),
          "true",
        );
        assert.equal(
          await page
            .getByRole("combobox", { name: "Authored breakpoint", exact: true })
            .getAttribute("data-value"),
          "tablet",
        );
        await page
          .frameLocator("iframe")
          .locator('[data-pagebldr-force-state="hover"]')
          .waitFor();
        await capture(`${name}-VIS-05`);
        await page.getByRole("radio", { name: "Normal", exact: true }).click();
        await page.getByRole("tab", { name: "Advanced", exact: true }).click();
        await capture(`${name}-VIS-06`);
        await select("Image");
        await page.getByRole("tab", { name: "Content", exact: true }).click();
        await page
          .getByRole("button", { name: "Choose media", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "Search media", exact: true })
          .fill("Reference image 01");
        await page
          .getByRole("button", {
            name: "Select Reference image 01.svg",
            exact: true,
          })
          .click();
        await capture(`${name}-VIS-07`);
        await page.keyboard.press("Escape");
        await menu("Page design");
        await page.getByRole("tab", { name: "Variables", exact: true }).click();
        await capture(`${name}-VIS-08`);
        await page.keyboard.press("Escape");
        await save();
        await page
          .getByRole("button", { name: "Publish", exact: true })
          .click();
        const publishAnyway = page.getByRole("button", {
          name: "Publish anyway",
          exact: true,
        });
        await Promise.race([
          page.getByRole("button", { name: "Update", exact: true }).waitFor(),
          publishAnyway.waitFor(),
        ]);
        if (await publishAnyway.isVisible()) await publishAnyway.click();
        await page
          .getByRole("button", { name: "Update", exact: true })
          .waitFor();
        await menu("History");
        await page.getByRole("tab", { name: "Revisions", exact: true }).click();
        await page.getByText("Live", { exact: true }).waitFor();
        await capture(`${name}-VIS-09`);
        const revision = page.getByRole("group", {
          name: /^publish Revision /,
        });
        await revision
          .getByRole("button", { name: "Restore", exact: true })
          .click();
        await page.getByRole("alertdialog").waitFor();
        await capture(`${name}-VIS-09-restore`);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.keyboard.press("Escape");
        await fresh(width, height, "/#/readonly");
        await capture(`${name}-VIS-11`);
      },
    );
  }
  if (suite === "full") {
    for (const [name, width, height] of [viewports[0], viewports[4]]) {
      await check(`${name} failure and conflict`, async () => {
        await fresh(width, height);
        await page.evaluate(() =>
          sessionStorage.setItem("pagebldr:reference:offline", "true"),
        );
        await page
          .getByRole("textbox", { name: "Page title", exact: true })
          .fill("Offline change");
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .waitFor();
        await capture(`${name}-VIS-12`);
        await page.evaluate(() =>
          sessionStorage.removeItem("pagebldr:reference:offline"),
        );
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await save();
        await page.evaluate(() => {
          const key = Object.keys(localStorage).find((key) =>
            key.startsWith("pagebldr:reference:lifecycle:"),
          );
          const state = JSON.parse(localStorage.getItem(key));
          state.document.version += 1;
          localStorage.setItem(key, JSON.stringify(state));
        });
        await page
          .getByRole("textbox", { name: "Page title", exact: true })
          .fill("Conflicting change");
        await page
          .getByRole("button", { name: "Resolve conflict", exact: true })
          .waitFor();
        await capture(`${name}-VIS-13`);
        await page
          .getByRole("button", { name: "Resolve conflict", exact: true })
          .click();
        await capture(`${name}-conflict-dialog`);
      });
    }
  }
  assert.deepEqual(errors, []);
} finally {
  const artifact =
    suite === "next"
      ? JSON.parse(
          await readFile(
            join(consumer, "examples/nextjs-basic/.next/packed-artifact.json"),
            "utf8",
          ),
        )
      : await (await page.request.get(`${origin}/packed-artifact.json`)).json();
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify({ engine, suite, viewportFilter, artifact, results, errors, libraryPresentation }, null, 2)}\n`,
  );
  await writeFile(
    join(output, "accessibility.json"),
    `${JSON.stringify(accessibility, null, 2)}\n`,
  );
  await browser.close();
}
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
