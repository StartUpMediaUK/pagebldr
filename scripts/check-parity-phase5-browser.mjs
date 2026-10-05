// Run against an isolated installed Reference Host, never workspace aliases.
// Usage: node scripts/check-parity-phase5-browser.mjs <consumer-dir> <chromium-executable>
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import process from "node:process";

const [consumerDirectory, executablePath] = process.argv.slice(2);
if (!consumerDirectory || !executablePath)
  throw new Error(
    "Supply the isolated consumer directory and Chromium executable.",
  );
const require = createRequire(join(resolve(consumerDirectory), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(
  "docs/plans/standalone-package/audits/evidence/parity-phase-5/browser-2026-10-05",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
// Screenshots are retained separately; action-only traces avoid embedding the
// large isolated-frame srcdoc repeatedly in every DOM snapshot.
await context.tracing.start({
  screenshots: false,
  snapshots: false,
  sources: false,
});
const page = await context.newPage();
page.setDefaultTimeout(5000);
const results = [];
const diagnostics = {
  pageErrors: [],
  failedRequests: [],
  consoleErrors: [],
  httpErrors: [],
};
page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error")
    diagnostics.consoleErrors.push(message.text());
});
page.on("requestfailed", (request) =>
  diagnostics.failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText,
  }),
);
let artifact;
page.on("response", (response) => {
  if (response.status() >= 400)
    diagnostics.httpErrors.push({
      url: response.url(),
      status: response.status(),
    });
});
async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
}
async function screenshot(name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
}
async function a11y(name) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await writeFile(
    join(output, `${name}-axe.json`),
    JSON.stringify(
      {
        violations: result.violations,
        passes: result.passes.map((item) => item.id),
      },
      null,
      2,
    ),
  );
  assert.equal(
    result.violations.length,
    0,
    result.violations
      .map((item) => `${item.id} (${item.nodes.length})`)
      .join(", "),
  );
}
async function fresh(width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto("http://localhost:5173/#/editor");
  await page.reload();
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
}
async function select(name, expand) {
  if (!(await page.getByRole("tree").isVisible()))
    await page
      .getByRole("button", { name: /^(Open )?Structure$/, exact: false })
      .first()
      .click();
  for (const parent of typeof expand === "string" ? [expand] : (expand ?? [])) {
    const button = page.getByRole("button", {
      name: `Expand ${parent}`,
      exact: true,
    });
    if (await button.count()) await button.click();
  }
  await page
    .getByRole("tree")
    .getByRole("button", { name, exact: true })
    .click();
  if (page.viewportSize().width < 768)
    await page
      .getByRole("button", { name: "Close Structure", exact: true })
      .first()
      .click();
}
try {
  artifact = await (
    await page.request.get("http://localhost:5173/packed-artifact.json")
  ).json();
  await fresh();
  await select("Project enquiry navigation", "Header content");
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  const menu = () =>
    page
      .frameLocator("iframe")
      .getByRole("navigation", { name: "Primary navigation", exact: true });
  await check("Menu Centre alignment reaches canvas", async () => {
    await page.getByRole("radio", { name: "Centre", exact: true }).click();
    assert.equal(
      await menu()
        .locator("ul")
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element)
              .justifyContent,
        ),
      "center",
    );
  });
  await check("Menu item gap reaches canvas", async () => {
    await page.getByLabel("Space between", { exact: true }).fill("40");
    assert.equal(
      await menu()
        .locator("ul")
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element).gap,
        ),
      "40px",
    );
  });
  await check(
    "Numeric rejection preserves draft with associated error",
    async () => {
      const input = page.getByLabel("Space between", { exact: true });
      await input.fill("-1");
      assert.equal(await input.inputValue(), "-1");
      assert.equal(await input.getAttribute("aria-invalid"), "true");
      const errorId = await input.getAttribute("aria-describedby");
      assert.match(
        await page.locator(`[id="${errorId}"]`).innerText(),
        /0 or more/,
      );
      await screenshot("menu-invalid-draft-desktop");
    },
  );
  await check("Keyboard Escape restores last valid numeric value", async () => {
    await page.getByLabel("Space between", { exact: true }).press("Escape");
    assert.equal(
      await page.getByLabel("Space between", { exact: true }).inputValue(),
      "40",
    );
    assert.equal(
      await page
        .getByLabel("Space between", { exact: true })
        .getAttribute("aria-invalid"),
      null,
    );
  });
  await check(
    "Unsafe responsive Style draft is rejected and Escape clears it",
    async () => {
      const input = page.getByLabel("Background Color", { exact: true });
      await input.fill("red;}body{display:none");
      assert.equal(await input.getAttribute("aria-invalid"), "true");
      assert.match(await page.getByRole("alert").innerText(), /unsafe CSS/);
      await input.press("Escape");
      assert.equal(await input.inputValue(), "");
    },
  );
  await check("Menu Style accessibility", () => a11y("menu-style-desktop"));
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page
    .getByLabel("Menu breakpoint", { exact: true })
    .selectOption("desktop");
  await page
    .getByLabel("Collapse style", { exact: true })
    .selectOption("fullscreen");
  if (
    (await page.getByLabel("On breakpoint", { exact: true }).inputValue()) !==
    "end"
  )
    await page.getByLabel("On breakpoint", { exact: true }).selectOption("end");
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await page.getByRole("radio", { name: "Bottom", exact: true }).click();
  await page.getByRole("radio", { name: "Background", exact: true }).click();
  await page.getByLabel("Item background", { exact: true }).fill("#123456");
  await page
    .getByLabel("Item hover background", { exact: true })
    .fill("#654321");
  await check("Menu edits reach controlled Host state", async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForFunction(() =>
      globalThis.localStorage.getItem("pagebldr-vite-example"),
    );
    const props = await page.evaluate(() => {
      const document = JSON.parse(
        globalThis.localStorage.getItem("pagebldr-vite-example"),
      );
      return Object.values(document.elements).find(
        (element) =>
          element.type === "menu" &&
          element.props.ariaLabel === "Primary navigation",
      ).props;
    });
    assert.equal(props.itemAlignment, "center");
    assert.equal(props.itemGap, 40);
    assert.equal(props.presentation, "fullscreen");
    assert.equal(props.fullscreenVerticalAlignment, "end");
    assert.equal(props.itemBackground, "#123456");
    assert.equal(props.itemHoverBackground, "#654321");
  });
  await screenshot("menu-style-configured-desktop");
  await page
    .getByRole("link", { name: "Open published rendering", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const publishedMenu = page.getByRole("navigation", {
    name: "Primary navigation",
    exact: true,
  });
  const toggle = publishedMenu.getByRole("button");
  await toggle.click();
  await screenshot("menu-fullscreen-actual-phone");
  await check("Menu fullscreen uses a viewport-fixed panel", async () => {
    const panel = publishedMenu.locator("ul");
    assert.equal(
      await panel.evaluate(
        (element) =>
          element.ownerDocument.defaultView.getComputedStyle(element).position,
      ),
      "fixed",
    );
  });
  await check(
    "Menu fullscreen vertical alignment reaches rendering",
    async () =>
      assert.equal(
        await publishedMenu.getAttribute("data-fullscreen-vertical-alignment"),
        "end",
      ),
  );
  await check("Menu collapsed position reaches rendering", async () =>
    assert.equal(
      await publishedMenu.getAttribute("data-breakpoint-position"),
      "end",
    ),
  );
  await check("Menu item background reaches rendering", async () =>
    assert.equal(
      await publishedMenu
        .locator("a")
        .first()
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element)
              .backgroundColor,
        ),
      "rgb(18, 52, 86)",
    ),
  );
  await check("Menu item hover background reaches rendering", async () => {
    await publishedMenu.locator("a").first().hover();
    assert.equal(
      await publishedMenu
        .locator("a")
        .first()
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element)
              .backgroundColor,
        ),
      "rgb(101, 67, 33)",
    );
  });
  await check("Menu disclosure controls its panel", async () => {
    const id = await toggle.getAttribute("aria-controls");
    assert.ok(id, "Toggle must identify its panel");
    assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
  });
  await check("Keyboard Escape closes Menu and restores focus", async () => {
    await toggle.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(
      await toggle.evaluate(
        (element) => element === element.ownerDocument.activeElement,
      ),
      true,
    );
  });
  await check("Open Menu accessibility", () => a11y("menu-open-phone"));
  await check("Menu fullscreen locks background scrolling", async () => {
    assert.equal(
      await page
        .locator("body")
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element)
              .overflow,
        ),
      "hidden",
    );
  });
  await check("Menu outside pointer closes the panel", async () => {
    await page
      .getByRole("link", { name: "Back to editor", exact: true })
      .dispatchEvent("pointerdown");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  });

  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["phone", 390, 844],
  ]) {
    await check(`Heading Content journey ${name}`, async () => {
      await fresh(width, height);
      await select("Page title", ["Hero content", "Hero message"]);
      const level = page.getByLabel("Level", { exact: true });
      await level.selectOption("2");
      assert.equal(
        await page
          .frameLocator("iframe")
          .locator('[data-pagebldr-element="reference-heading-8"]')
          .evaluate((element) => element.tagName),
        "H2",
      );
      await screenshot(`heading-content-${name}`);
    });
    await check(`Heading Content accessibility ${name}`, () =>
      a11y(`heading-content-${name}`),
    );
    await check(`Container Advanced journey ${name}`, async () => {
      await select("Hero");
      await page.getByRole("tab", { name: "Advanced", exact: true }).click();
      await page.getByLabel("Padding", { exact: true }).fill("32px");
      assert.equal(
        await page.getByLabel("Padding", { exact: true }).inputValue(),
        "32px",
      );
      await screenshot(`container-advanced-${name}`);
    });
    await check(`Container Advanced accessibility ${name}`, () =>
      a11y(`container-advanced-${name}`),
    );
    await check(`Page design Variables journey ${name}`, async () => {
      await page
        .getByRole("button", { name: "More editor actions", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Page design", exact: true })
        .click();
      await page.getByRole("tab", { name: "Variables", exact: true }).click();
      assert.match(await page.getByRole("dialog").innerText(), /Colour/);
      await page
        .getByLabel("Add variable", { exact: true })
        .fill("Browser accent");
      await page.getByLabel("Add variable", { exact: true }).press("Enter");
      await page.getByLabel("Browser accent value", { exact: true }).waitFor();
      await screenshot(`page-variables-${name}`);
    });
    await check(`Page design Variables accessibility ${name}`, () =>
      a11y(`page-variables-${name}`),
    );
  }
  await check(
    "Container Tablet Hover Style and per-property reset",
    async () => {
      await fresh();
      await select("Hero");
      await page.getByRole("tab", { name: "Style", exact: true }).click();
      await page
        .getByRole("radiogroup", { name: "Authored breakpoint", exact: true })
        .getByRole("radio", { name: "Tablet", exact: true })
        .click();
      await page.getByRole("radio", { name: "Hover", exact: true }).click();
      await page
        .getByLabel("Background Color", { exact: true })
        .fill("#112233");
      const selected = page
        .frameLocator("iframe")
        .locator('[data-pagebldr-force-state="hover"]');
      await selected.waitFor();
      assert.equal(
        await selected.evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element)
              .backgroundColor,
        ),
        "rgb(17, 34, 51)",
      );
      await screenshot("container-style-tablet-hover-desktop");
      await page
        .getByRole("button", { name: "Reset Background Color", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Background Color", { exact: true }).inputValue(),
        "",
      );
    },
  );
  await check("Container Tablet Hover accessibility", () =>
    a11y("container-style-tablet-hover-desktop"),
  );
} finally {
  await context.tracing.stop({
    path: join(output, "phase5-browser-trace.zip"),
  });
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        artifact,
        browser: browser.version(),
        viewports: [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
        ],
        results,
        diagnostics,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  `${results.filter((result) => result.status === "pass").length}/${results.length} checks passed; evidence: ${output}`,
);
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
