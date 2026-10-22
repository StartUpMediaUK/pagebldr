// Run only against the installed, packed Reference Host. No internal imports.
// Usage: node scripts/check-parity-phase6-browser.mjs <consumer> <chromium> [output]
/* global localStorage */
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const [consumer, executablePath, evidence] = process.argv.slice(2);
if (!consumer || !executablePath)
  throw new Error("Supply the packed consumer and Chromium executable.");
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
// Resolve the installed ESM-only manifest's deliberate public export targets.
const installedPackage = join(resolve(consumer), "node_modules/pagebldr");
const manifest = JSON.parse(
  await readFile(join(installedPackage, "package.json"), "utf8"),
);
const api = await import(
  pathToFileURL(join(installedPackage, manifest.exports["."].import))
);
const { standardBlocks } = await import(
  pathToFileURL(join(installedPackage, manifest.exports["./library"].import))
);
const builder = api.createPagebldr({
  namespace: "browser-validation",
  elements: api.standardElements,
  styleCapabilities: api.standardStyleCapabilities,
});
const output = resolve(
  evidence ?? "release-evidence/parity-phase-6/browser-2026-10-08",
);
await mkdir(output, { recursive: true });
const origin = process.env.PAGEBLDR_PHASE6_ORIGIN ?? "http://localhost:5175";
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.tracing.start({
  screenshots: false,
  snapshots: false,
  sources: false,
});
const page = await context.newPage();
page.setDefaultTimeout(6000);
const results = [];
const pageErrors = [];
const consoleMessages = [];
const requestFailures = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    consoleMessages.push({ type: message.type(), text: message.text() });
});
page.on("requestfailed", (request) =>
  requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText,
  }),
);
const artifact = await (
  await page.request.get(`${origin}/packed-artifact.json`)
).json();
async function check(name, run) {
  if (
    process.env.PAGEBLDR_PHASE6_FILTER &&
    !new RegExp(process.env.PAGEBLDR_PHASE6_FILTER, "u").test(name)
  )
    return;
  try {
    await run();
    results.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
    await page.screenshot({
      path: join(output, `failure-${results.length}.png`),
    });
  }
}
async function fresh(route = "#/editor", width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(`${origin}/${route}`);
  await page.reload();
  if (route.startsWith("#/editor") || route === "#/readonly")
    await page
      .frameLocator("iframe")
      .locator("[data-pagebldr-renderer]")
      .waitFor();
}
async function eventually(read, expected) {
  const deadline = Date.now() + 6000;
  let value;
  do {
    value = await read();
    if (value === expected) return;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  assert.equal(value, expected);
}
async function openLibrary(tab) {
  const back = page.getByRole("button", {
    name: "Back to Add to page",
    exact: true,
  });
  if (await back.isVisible()) await back.click();
  if (!(await page.getByRole("tab", { name: tab, exact: true }).isVisible())) {
    const open = page
      .getByRole("button", { name: /^(Open Add panel|Add to page|Add)$/ })
      .first();
    await open.click();
  }
  await page.getByRole("tab", { name: tab, exact: true }).click();
}
async function choose(label, value) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function doc() {
  await page.evaluate(() => localStorage.removeItem("pagebldr-vite-example"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(
    () => localStorage.getItem("pagebldr-vite-example") !== null,
  );
  const value = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pagebldr-vite-example")),
  );
  const validation = builder.documents.validate(value);
  assert.equal(validation.valid, true, validation.error?.message);
  return value;
}
async function axe(name, excludeContent = false) {
  const full = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await writeFile(
    join(output, `${name}-full-axe.json`),
    JSON.stringify({ violations: full.violations }, null, 2),
  );
  const scoped = excludeContent
    ? await new AxeBuilder({ page })
        .exclude("iframe")
        .exclude(".pb-library-preview-document")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    : full;
  await writeFile(
    join(output, `${name}-ui-axe.json`),
    JSON.stringify({ violations: scoped.violations }, null, 2),
  );
  assert.equal(
    scoped.violations.length,
    0,
    scoped.violations
      .map((item) => `${item.id}: ${item.nodes.length}`)
      .join(", "),
  );
}
async function snap(name) {
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
}
async function openMedia() {
  await page
    .getByRole("button", { name: "Browse all media", exact: true })
    .click();
  await page.getByRole("button", { name: /^Select \(/ }).waitFor();
}
async function mediaSearch(query) {
  await page
    .getByRole("textbox", { name: "Search media", exact: true })
    .fill(query);
  await page.waitForTimeout(120);
}
async function selectImage(name) {
  await page
    .getByRole("button", { name: `Select ${name}`, exact: true })
    .click();
}
async function structure() {
  if (!(await page.getByRole("tree").isVisible()))
    await page
      .getByRole("button", { name: /^(Open )?Structure$/ })
      .first()
      .click();
}
async function selectElement(name) {
  await structure();
  await page
    .getByRole("tree")
    .getByRole("button", { name, exact: true })
    .click();
  await page.getByRole("tab", { name: "Content", exact: true }).click();
}
async function pageDesign() {
  await page
    .getByRole("button", { name: "More editor actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Page design", exact: true })
    .click();
  await page.getByRole("tab", { name: "SEO & social", exact: true }).click();
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII=",
  "base64",
);

try {
  await check(
    "23 standard Blocks render and preview does not mutate",
    async () => {
      await fresh();
      await openLibrary("Blocks");
      assert.equal(await page.locator("[data-library-key]").count(), 23);
      const before = await doc();
      await openLibrary("Blocks");
      await page
        .locator('[data-library-key="simple-header"]')
        .getByRole("button", { name: "Preview Simple navigation", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await snap("blocks-preview-desktop");
      await axe("blocks-preview-desktop", true);
      await page
        .getByRole("button", { name: "Close preview", exact: true })
        .click();
      assert.deepEqual(await doc(), before);
    },
  );
  for (const block of standardBlocks)
    await check(`inserts valid ordinary Block ${block.key}`, async () => {
      await fresh();
      const before = await doc();
      await openLibrary("Blocks");
      await page
        .locator(`[data-library-key="${block.key}"]`)
        .getByRole("button", { name: "Insert block", exact: true })
        .click();
      const after = await doc();
      assert.equal(after.id, before.id);
      assert.ok(
        Object.keys(after.elements).length >
          Object.keys(before.elements).length,
      );
      assert.equal(
        after.elements[after.rootId].children.length,
        before.elements[before.rootId].children.length + 1,
      );
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.deepEqual(await doc(), before);
    });
  await check(
    "library search/favourites/state survive inspector and return",
    async () => {
      await fresh();
      await openLibrary("Blocks");
      await page
        .getByRole("textbox", { name: "Search library", exact: true })
        .fill("navigation");
      const card = page.locator('[data-library-key="simple-header"]');
      await card
        .getByRole("button", {
          name: "Favourite Simple navigation",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Favourites only", exact: true })
        .click();
      assert.equal(await page.locator("[data-library-key]").count(), 1);
      await card
        .getByRole("button", { name: "Insert block", exact: true })
        .click();
      await openLibrary("Blocks");
      assert.equal(
        await page
          .getByRole("textbox", { name: "Search library", exact: true })
          .inputValue(),
        "navigation",
      );
      assert.equal(await page.locator("[data-library-key]").count(), 1);
      await snap("blocks-filtered-desktop");
      await axe("blocks-filtered-desktop", true);
      await page
        .getByRole("button", { name: "Favourites only", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Search library", exact: true })
        .fill("");
    },
  );
  const templates = JSON.parse(
    await readFile(
      join(resolve(consumer), "fixtures/library/index.json"),
      "utf8",
    ),
  );
  for (const template of templates)
    await check(
      `Host-only Template preview/apply ${template.key}`,
      async () => {
        await fresh();
        const before = await doc();
        await openLibrary("Templates");
        const card = page.locator(`[data-library-key="${template.key}"]`);
        await card
          .getByRole("button", {
            name: `Preview ${template.label}`,
            exact: true,
          })
          .click();
        await page.getByRole("dialog").waitFor();
        await page
          .getByRole("button", { name: "Close preview", exact: true })
          .click();
        assert.deepEqual(await doc(), before);
        await card
          .getByRole("button", { name: "Apply template", exact: true })
          .click();
        const after = await doc();
        assert.equal(after.id, before.id);
        assert.equal(after.title, before.title);
        assert.equal(after.slug, before.slug);
        assert.deepEqual(after.settings.seo, before.settings.seo);
        assert.notDeepEqual(after.elements, before.elements);
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        assert.deepEqual(await doc(), before);
      },
    );
  await check(
    "Host Template edit navigation and delete confirmation",
    async () => {
      await fresh();
      await openLibrary("Templates");
      const card = page.locator('[data-library-key="business-pulse"]');
      await card
        .getByRole("button", { name: "Delete Business Pulse", exact: true })
        .click();
      await page.getByRole("alertdialog").waitFor();
      await axe("template-delete", true);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(await card.count(), 1);
      await card
        .getByRole("button", { name: "Edit Business Pulse", exact: true })
        .click();
      await page.waitForURL("**/#/editor/template/business-pulse");
    },
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ]) {
    await check(
      `media pending selection/cancel/keyboard/view modes ${name}`,
      async () => {
        await fresh("#/media", width, height);
        await openMedia();
        await page.locator(".pb-media-card").first().waitFor();
        await snap(`media-masonry-${name}`);
        await axe(`media-masonry-${name}`);
        await mediaSearch("Reference image 01");
        await selectImage("Reference image 01.svg");
        await mediaSearch("Reference image 02");
        await selectImage("Reference image 02.svg");
        assert.equal(
          await page
            .getByRole("button", { name: "Select (2)", exact: true })
            .count(),
          1,
        );
        await choose("Media view", "Grid");
        assert.ok(
          (await page.locator(".pb-media-card").first().boundingBox()).width >=
            100,
          "Responsive media cards must retain a usable width",
        );
        await snap(`media-grid-${name}`);
        await axe(`media-grid-${name}`);
        await choose("Media view", "List");
        await snap(`media-list-${name}`);
        await axe(`media-list-${name}`);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        assert.equal(
          await page
            .getByRole("status", { name: "Committed media" })
            .textContent(),
          "None",
        );
        await openMedia();
        await mediaSearch("Reference image 03");
        const choice = page.getByRole("button", {
          name: "Select Reference image 03.svg",
          exact: true,
        });
        await choice.focus();
        await page.keyboard.press("Space");
        await page
          .getByRole("button", { name: "Select (1)", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        assert.match(
          await page
            .getByRole("status", { name: "Committed media" })
            .textContent(),
          /image-3/u,
        );
      },
    );
  }
  await check(
    "media ordering, pagination/filter/sort and independent read-only adapter",
    async () => {
      await fresh("#/media");
      await openMedia();
      await choose("Media type", "audio");
      await page
        .getByRole("button", { name: "Select Audio sample.mp3", exact: true })
        .waitFor();
      await choose("Media type", "image");
      await choose("Media sort", "Name A–Z");
      await page
        .getByRole("button", {
          name: "Select Reference image 01.svg",
          exact: true,
        })
        .waitFor();
      await selectImage("Reference image 02.svg");
      await selectImage("Reference image 01.svg");
      await page
        .getByRole("button", { name: "Select (2)", exact: true })
        .click();
      const committed = await page
        .getByRole("status", { name: "Committed media" })
        .textContent();
      assert.ok(committed.indexOf("image-2") < committed.indexOf("image-1"));
      await openMedia();
      await choose("Media library", "curated-media");
      await page.getByRole("tab", { name: "Add", exact: true }).click();
      assert.equal(await page.locator('input[type="file"]').isDisabled(), true);
      await page.getByRole("tab", { name: "Gallery", exact: true }).click();
      await selectImage("Curated illustration");
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .click();
      assert.match(
        await page
          .getByRole("status", { name: "Committed media" })
          .textContent(),
        /curated-media/u,
      );
    },
  );
  await check(
    "upload automatic progress, retry/remove, tab/closure persistence and explicit commit",
    async () => {
      await fresh("#/media");
      await openMedia();
      await page.getByRole("tab", { name: "Add", exact: true }).click();
      await page.locator('input[type="file"]').setInputFiles({
        name: "fail-once-image.png",
        mimeType: "image/png",
        buffer: png,
      });
      await page
        .getByRole("button", { name: "Retry upload", exact: true })
        .waitFor();
      await snap("upload-failure-desktop");
      await axe("upload-failure-desktop");
      await page
        .getByRole("button", { name: "Retry upload", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .waitFor();
      await page.locator('input[type="file"]').setInputFiles({
        name: "background-upload.png",
        mimeType: "image/png",
        buffer: png,
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.waitForTimeout(1400);
      assert.equal(
        await page
          .getByRole("status", { name: "Committed media" })
          .textContent(),
        "None",
      );
      await openMedia();
      await page.getByRole("tab", { name: "Add", exact: true }).click();
      await eventually(
        () =>
          page
            .locator(".pb-media-upload")
            .filter({ hasText: "background-upload.png" })
            .textContent(),
        "background-upload.png100% · complete",
      );
      await page
        .getByRole("button", {
          name: "Remove upload fail-once-image.png",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .locator(".pb-media-upload")
          .filter({ hasText: "fail-once-image.png" })
          .count(),
        0,
      );
    },
  );
  await check(
    "ten-file bound, upload cancellation and external URL validation",
    async () => {
      await fresh("#/media");
      await openMedia();
      await page.getByRole("tab", { name: "Add", exact: true }).click();
      await page.locator('input[type="file"]').setInputFiles(
        Array.from({ length: 11 }, (_, i) => ({
          name: `image-${i}.png`,
          mimeType: "image/png",
          buffer: png,
        })),
      );
      await page.getByRole("alert").filter({ hasText: "ten files" }).waitFor();
      assert.equal(await page.locator(".pb-media-upload").count(), 0);
      await page.locator('input[type="file"]').setInputFiles({
        name: "cancel-upload.png",
        mimeType: "image/png",
        buffer: png,
      });
      await page
        .getByRole("button", { name: "Cancel upload", exact: true })
        .click();
      assert.match(
        await page
          .locator(".pb-media-upload")
          .filter({ hasText: "cancel-upload.png" })
          .textContent(),
        /cancelled/u,
      );
      await page
        .getByRole("textbox", { name: "External URL", exact: true })
        .fill("http://example.com/image.png");
      await page
        .getByRole("button", { name: "Add external media", exact: true })
        .click();
      await page.getByRole("alert").filter({ hasText: "HTTPS" }).waitFor();
      await page
        .getByRole("textbox", { name: "External URL", exact: true })
        .fill("https://example.com/image.png");
      await page
        .getByRole("button", { name: "Add external media", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .click();
      assert.match(
        await page
          .getByRole("status", { name: "Committed media" })
          .textContent(),
        /external/u,
      );
    },
  );
  for (const [query, name, selector] of [
    ["Reference image 01", "Reference image 01.svg", ".pb-media-viewer img"],
    ["Flower", "Flower video.mp4", ".pb-media-viewer video"],
    ["Audio", "Audio sample.mp3", ".pb-media-viewer audio"],
    ["document.pdf", "Reference document.pdf", ".pb-media-viewer iframe"],
    ["document.txt", "Reference document.txt", ".pb-media-viewer pre"],
    ["document.csv", "Reference document.csv", ".pb-media-viewer pre"],
    ["document.docx", "Reference document.docx", null],
    ["document.xlsx", "Reference document.xlsx", null],
    ["document.pptx", "Reference document.pptx", null],
    ["Unavailable", "Unavailable image.png", null],
  ])
    await check(`viewer safe ${name}`, async () => {
      await fresh("#/media");
      await openMedia();
      await mediaSearch(query);
      await page
        .getByRole("button", { name: `Preview ${name}`, exact: true })
        .click();
      if (selector) await page.locator(selector).waitFor();
      if (query.includes("pdf")) await page.waitForTimeout(1500);
      if (["audio", "video"].some((kind) => selector?.endsWith(kind)))
        assert.equal(
          await page.locator(selector).evaluate((element) => element.autoplay),
          false,
        );
      if (query.includes("txt"))
        assert.match(await page.locator(selector).textContent(), /<script>/u);
      await snap(`viewer-${name.replace(/[^a-z0-9]/giu, "-")}`);
      await axe(`viewer-${name.replace(/[^a-z0-9]/giu, "-")}`);
      await page.keyboard.press("Escape");
      await page.locator(".pb-media-viewer").waitFor({ state: "detached" });
      if (query === "Unavailable")
        assert.equal(
          await page
            .getByRole("button", { name: `Select ${name}`, exact: true })
            .isDisabled(),
          true,
        );
      assert.equal(
        await page
          .getByRole("button", { name: "Select (0)", exact: true })
          .count(),
        1,
      );
    });
  await check(
    "read-only library disables mutation and permits preview",
    async () => {
      await fresh("#/readonly");
      await openLibrary("Blocks");
      assert.equal(
        await page
          .locator('[data-library-key="simple-header"]')
          .getByRole("button", { name: "Insert block", exact: true })
          .isDisabled(),
        true,
      );
      await page
        .locator('[data-library-key="simple-header"]')
        .getByRole("button", { name: "Preview Simple navigation", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Insert block", exact: true })
          .isDisabled(),
        true,
      );
    },
  );
  await check(
    "saved Block keyboard save, validation, reload, independent insertion and deletion",
    async () => {
      await fresh("#/editor/elements");
      await page.evaluate(() =>
        localStorage.removeItem("vite-example:reference-blocks"),
      );
      await page.reload();
      await selectElement("Image");
      await page
        .getByRole("button", { name: "Actions for Image", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Save as Block", exact: true })
        .click();
      const name = page.getByRole("textbox", {
        name: "Block name",
        exact: true,
      });
      await name.fill(" ");
      await page
        .getByRole("button", { name: "Save Block", exact: true })
        .click();
      await page
        .getByText("Use a name from 1 to 80 characters.", { exact: true })
        .waitFor();
      await name.fill("Browser saved image");
      await name.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.reload();
      const before = await doc();
      await openLibrary("Blocks");
      await page
        .getByRole("textbox", { name: "Search library", exact: true })
        .fill("Browser saved image");
      const card = page
        .locator("[data-library-key]")
        .filter({ hasText: "Browser saved image" });
      await card
        .getByRole("button", { name: "Insert block", exact: true })
        .click();
      const after = await doc();
      const copies = Object.values(after.elements).filter(
        (item) => item.type === "image",
      );
      assert.equal(
        copies.length,
        Object.values(before.elements).filter((item) => item.type === "image")
          .length + 1,
      );
      assert.equal(new Set(copies.map((item) => item.id)).size, copies.length);
      await openLibrary("Blocks");
      await card
        .getByRole("button", {
          name: "Delete Browser saved image",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Delete entry", exact: true })
        .click();
      await card.waitFor({ state: "detached" });
      assert.deepEqual(await doc(), after);
    },
  );
  await check(
    "saved Block Host rejects malformed preferences and caps at fifty",
    async () => {
      const sample = standardBlocks[0].create();
      await page.evaluate(
        (clipboard) =>
          localStorage.setItem(
            "vite-example:reference-blocks",
            JSON.stringify(
              Array.from({ length: 50 }, (_, i) => ({
                key: `saved-${i}`,
                label: `Saved ${i}`,
                clipboard,
              })),
            ),
          ),
        sample,
      );
      await fresh("#/editor/elements");
      await selectElement("Image");
      await page
        .getByRole("button", { name: "Actions for Image", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Save as Block", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save Block", exact: true })
        .click();
      await page
        .getByText("The saved Block library is full (50 Blocks).", {
          exact: true,
        })
        .waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.evaluate(() =>
        localStorage.setItem(
          "vite-example:reference-blocks",
          JSON.stringify([
            {
              key: "invalid",
              label: "Invalid saved Block",
              clipboard: { format: "invalid" },
            },
          ]),
        ),
      );
      await page.reload();
      await openLibrary("Blocks");
      await page
        .getByRole("textbox", { name: "Search library", exact: true })
        .fill("Invalid saved Block");
      assert.equal(await page.locator("[data-library-key]").count(), 0);
      await page.evaluate(() =>
        localStorage.removeItem("vite-example:reference-blocks"),
      );
    },
  );
  await check(
    "Block drag targets Structure and canvas with independent IDs and undo",
    async () => {
      await fresh("#/editor/elements");
      await structure();
      const before = await doc();
      await openLibrary("Blocks");
      const card = page.locator('[data-library-key="simple-header"]');
      const row = page.getByRole("treeitem").filter({
        has: page.getByRole("button", {
          name: "All standard Elements",
          exact: true,
        }),
      });
      await card.dragTo(row);
      const after = await doc();
      assert.ok(
        Object.keys(after.elements).length >
          Object.keys(before.elements).length,
      );
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.deepEqual(await doc(), before);
      await openLibrary("Blocks");
      await card.dragTo(
        page
          .frameLocator("iframe")
          .locator(`[data-pagebldr-element="${before.rootId}"]`),
        { targetPosition: { x: 80, y: 80 } },
      );
      assert.ok(
        Object.keys((await doc()).elements).length >
          Object.keys(before.elements).length,
      );
    },
  );
  await check(
    "Gallery ordered append, per-usage alt/caption, reorder/remove and duplicate exclusion",
    async () => {
      await fresh("#/editor/elements");
      await selectElement("Gallery / Carousel");
      const before = await doc();
      await page
        .getByRole("button", { name: "Add media", exact: true })
        .click();
      await mediaSearch("Reference image 01");
      await selectImage("Reference image 01.svg");
      await mediaSearch("Reference image 02");
      await selectImage("Reference image 02.svg");
      await page
        .getByRole("button", { name: "Select (2)", exact: true })
        .click();
      let document = await doc();
      let items =
        document.elements["all-elements-gallery-carousel"].props.items;
      assert.equal(items.length, 5);
      assert.equal(items[3].source.reference.value, "image-1");
      assert.equal(items[4].source.reference.value, "image-2");
      const usage = page.locator(".pb-media-usage").nth(3);
      await usage
        .getByRole("textbox", { name: "Alternative text", exact: true })
        .fill("Independently authored alt");
      await usage
        .getByRole("textbox", { name: "Caption", exact: true })
        .fill("Per-usage caption");
      await usage
        .getByRole("switch", {
          name: "Alternative text confirmed",
          exact: true,
        })
        .click();
      await usage
        .getByRole("switch", { name: "Decorative", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Move media 4 down", exact: true })
        .click();
      document = await doc();
      items = document.elements["all-elements-gallery-carousel"].props.items;
      assert.equal(items[4].alt, "Independently authored alt");
      assert.equal(items[4].caption, "Per-usage caption");
      assert.equal(items[4].altConfirmed, true);
      assert.equal(items[4].decorative, true);
      await page
        .getByRole("button", { name: "Add media", exact: true })
        .click();
      await mediaSearch("Reference image 01");
      assert.equal(
        await page
          .getByRole("button", {
            name: "Select Reference image 01.svg",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await snap("gallery-usage-desktop");
      await axe("gallery-usage-desktop", true);
      await page
        .getByRole("button", { name: "Remove media 5", exact: true })
        .click();
      assert.equal(
        (await doc()).elements["all-elements-gallery-carousel"].props.items
          .length,
        4,
      );
      assert.deepEqual(
        before.elements["all-elements-gallery-carousel"].props.items.length,
        3,
      );
    },
  );
  await check(
    "Image single replace restores existing off-page selection and stores usage accessibility",
    async () => {
      await fresh("#/editor/elements");
      await selectElement("Image");
      await page
        .getByRole("button", { name: "Choose media", exact: true })
        .click();
      await mediaSearch("Reference image 01");
      await selectImage("Reference image 01.svg");
      await mediaSearch("Reference image 02");
      await selectImage("Reference image 02.svg");
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .click();
      const document = await doc();
      const image = Object.values(document.elements).find(
        (item) => item.type === "image",
      );
      assert.equal(image.props.source.reference.value, "image-2");
      assert.equal(image.props.alt, "Reference image 02.svg");
      assert.equal(image.props.altConfirmed, false);
      await page
        .getByRole("button", { name: "Choose media", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.deepEqual(await doc(), document);
    },
  );
  await check(
    "Social image stages until Page design Apply and cancel preserves Document",
    async () => {
      await fresh();
      const before = await doc();
      await pageDesign();
      await page
        .getByRole("button", { name: "Choose social image", exact: true })
        .click();
      await mediaSearch("Reference image 01");
      await selectImage("Reference image 01.svg");
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.deepEqual(await doc(), before);
      await pageDesign();
      await page
        .getByRole("button", { name: "Choose social image", exact: true })
        .click();
      await mediaSearch("Reference image 02");
      await selectImage("Reference image 02.svg");
      await page
        .getByRole("button", { name: "Select (1)", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Apply page design", exact: true })
        .click();
      assert.deepEqual((await doc()).settings.seo.socialImage, {
        kind: "asset",
        value: "image-2",
      });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.deepEqual(await doc(), before);
    },
  );
  await check(
    "Gallery thirty-item maximum and minimum-one removal guard",
    async () => {
      await fresh("#/editor/elements");
      await selectElement("Gallery / Carousel");
      await page
        .getByRole("button", { name: "Add media", exact: true })
        .click();
      for (let index = 1; index <= 27; index++) {
        const name = `Reference image ${String(index).padStart(2, "0")}.svg`;
        await mediaSearch(name);
        await selectImage(name);
      }
      await mediaSearch("Reference image 28.svg");
      assert.equal(
        await page
          .getByRole("button", {
            name: "Select Reference image 28.svg",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Select (27)", exact: true })
        .click();
      assert.equal(
        (await doc()).elements["all-elements-gallery-carousel"].props.items
          .length,
        30,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Add media", exact: true })
          .isDisabled(),
        true,
      );
      for (let index = 30; index > 1; index--)
        await page
          .getByRole("button", { name: `Remove media ${index}`, exact: true })
          .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Remove media 1", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        (await doc()).elements["all-elements-gallery-carousel"].props.items
          .length,
        1,
      );
    },
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ])
    await check(
      `library keyboard preview and Host Template layout ${name}`,
      async () => {
        await fresh("#/editor", width, height);
        if (await page.getByRole("tree").isVisible())
          await page
            .getByRole("button", { name: "Close Structure", exact: true })
            .first()
            .click();
        await openLibrary("Blocks");
        await page
          .getByRole("textbox", { name: "Search library", exact: true })
          .fill("Simple navigation");
        await snap(`library-blocks-${name}`);
        await axe(`library-blocks-${name}`, true);
        const preview = page.getByRole("button", {
          name: "Preview Simple navigation",
          exact: true,
        });
        await preview.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor();
        await snap(`library-preview-${name}`);
        await axe(`library-preview-${name}`, true);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page
          .getByRole("textbox", { name: "Search library", exact: true })
          .fill("");
        await openLibrary("Templates");
        await snap(`library-templates-${name}`);
        await axe(`library-templates-${name}`, true);
      },
    );
  await check("No uncaught browser exceptions", async () =>
    assert.deepEqual(pageErrors, []),
  );
} finally {
  await context.tracing.stop({ path: join(output, "actions.zip") });
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        artifact,
        origin,
        results,
        pageErrors,
        consoleMessages,
        requestFailures,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
assert.equal(
  results.filter((item) => item.status === "fail").length,
  0,
  "Phase 6 browser assertions failed; see evidence.",
);
assert.deepEqual(pageErrors, [], "Browser exceptions occurred.");
