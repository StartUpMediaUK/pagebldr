/* global document, getComputedStyle, window */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, origin, evidence, engine = "chromium"] = process.argv.slice(2);
if (!consumer || !origin || !evidence)
  throw new Error(
    "Usage: node scripts/check-capabilities-browser.mjs <packed-consumer> <origin> <evidence> [chromium|webkit|firefox]",
  );
const require = createRequire(join(resolve(consumer), "package.json"));
const { [engine]: browserType } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(evidence);
await mkdir(output, { recursive: true });
const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: output },
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const results = [];
async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
const tabs = page.locator(
  '[data-pagebldr-element="tabs"] > [role="tablist"] > [role="tab"]',
);
const visible = async (locator) => {
  await locator.waitFor({ state: "visible" });
};
await check("SSR hydration and manual tab keyboard activation", async () => {
  await page.goto(`${origin}/capabilities-ssr`);
  await page.locator('[data-tabs-enhanced="true"]').first().waitFor();
  await tabs.nth(0).focus();
  await tabs.nth(0).press("ArrowRight");
  assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
  assert.equal(
    await tabs.nth(1).evaluate((node) => document.activeElement === node),
    true,
  );
  await tabs.nth(1).press("Enter");
  await visible(page.locator('[data-pagebldr-element="form"] input'));
});
await check(
  "Host pending/error/success, mounted values and unavailable Resources",
  async () => {
    const form = page.locator('[data-pagebldr-element="form"] form');
    await form.getByLabel("Email").fill("fail@example.com");
    await form.getByRole("button").click();
    assert.equal(await form.getByRole("button").isDisabled(), true);
    await visible(form.getByRole("alert"));
    await form.getByLabel("Email").fill("hello@example.com");
    await tabs.nth(0).click();
    await tabs.nth(1).click();
    assert.equal(
      await form.getByLabel("Email").inputValue(),
      "hello@example.com",
    );
    await form.getByRole("button").click();
    await visible(form.getByText("Request received.", { exact: true }));
    await tabs.nth(2).click();
    await visible(
      page
        .locator('[data-pagebldr-element="missing-form"]')
        .getByText("This form is currently unavailable.", { exact: true }),
    );
  },
);
await check(
  "nested tabs preserve outer state and exclude inactive controls",
  async () => {
    await tabs.nth(0).click();
    const nested = page.locator(
      '[data-pagebldr-element="nested-tabs"] > [role="tablist"] > [role="tab"]',
    );
    await nested.nth(0).focus();
    await nested.nth(0).press("ArrowDown");
    await visible(page.locator('[data-pagebldr-element="nested-form"] input'));
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(
      await page.locator('[data-pagebldr-element="form"] input').isVisible(),
      false,
    );
    await nested.nth(1).press("Home");
    assert.equal(await nested.nth(0).getAttribute("aria-selected"), "true");
  },
);
await check(
  "gallery lightbox captions, containment, Escape and focus restoration",
  async () => {
    const gallery = page.locator('[data-pagebldr-element="grid"]');
    const trigger = gallery.locator("[data-gallery-open]").first();
    await trigger.click();
    const dialog = gallery.getByRole("dialog");
    await visible(dialog);
    const caption = await dialog.locator("figcaption").textContent();
    await dialog
      .getByRole("button", { name: "Next image", exact: true })
      .click();
    assert.notEqual(await dialog.locator("figcaption").textContent(), caption);
    for (let index = 0; index < 8; index++) await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), false);
    assert.equal(
      await trigger.evaluate((node) => document.activeElement === node),
      true,
    );
    await page.screenshot({
      path: join(output, "desktop.png"),
      fullPage: true,
    });
  },
);
await check(
  "grid and masonry respond to container resizing with intrinsic dimensions",
  async () => {
    for (const [width, count] of [
      [1440, 3],
      [900, 2],
      [390, 1],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const grid = page.locator(
        '[data-pagebldr-element="grid"] .pagebldr-gallery',
      );
      await grid.evaluate((node) => node.getBoundingClientRect());
      assert.equal(
        await grid.evaluate(
          (node) =>
            getComputedStyle(node).gridTemplateColumns.split(" ").length,
        ),
        count,
      );
      const masonry = page.locator(
        '[data-pagebldr-element="masonry"] .pagebldr-gallery',
      );
      assert.equal(
        await masonry.evaluate((node) =>
          Number(getComputedStyle(node).columnCount),
        ),
        count,
      );
      assert.deepEqual(
        await masonry
          .locator(":scope > figure img")
          .evaluateAll((nodes) =>
            nodes.map((node) => [
              node.getAttribute("width"),
              node.getAttribute("height"),
            ]),
          ),
        [
          ["600", "400"],
          ["600", "800"],
          ["600", "600"],
        ],
      );
    }
    const images = page.locator(
      '[data-pagebldr-element="masonry"] .pagebldr-gallery > figure img',
    );
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((node) => node.decode());
      assert.equal(await image.evaluate((node) => node.naturalWidth > 0), true);
    }
    await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
  },
);
await check(
  "nested navigation keyboard, touch-sized mobile panel and sticky positioning",
  async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const menu = page.locator('[data-pagebldr-element="nav"]');
    await menu.locator("summary").nth(0).focus();
    await menu.locator("summary").nth(0).press("Enter");
    await visible(menu.locator("summary").nth(1));
    await menu.locator("summary").nth(1).press("Enter");
    await visible(menu.getByRole("link", { name: "Gallery", exact: true }));
    await menu
      .getByRole("link", { name: "Gallery", exact: true })
      .press("Escape");
    assert.equal(
      await menu.locator("details").nth(1).getAttribute("open"),
      null,
    );
    await menu.locator("summary").nth(1).press("Enter");
    await menu.getByRole("link", { name: "Gallery", exact: true }).click();
    assert.equal(await menu.locator("details[open]").count(), 0);
    await page.evaluate(() => window.scrollTo(0, 500));
    assert.equal(
      Math.round(
        await page
          .locator('[data-pagebldr-element="header"]')
          .evaluate((node) => node.getBoundingClientRect().top),
      ),
      12,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await menu.getByRole("button", { name: "Open navigation" }).click();
    await menu.locator("summary").nth(0).click();
    await visible(menu.locator("summary").nth(1));
    await menu.locator("summary").nth(1).click();
    await menu.getByRole("link", { name: "Gallery", exact: true }).click();
    assert.equal(await menu.getAttribute("data-open"), "false");
    await page.waitForFunction(
      () => {
        const target = document.querySelector('[data-pagebldr-element="grid"]');
        const header = document.querySelector(
          '[data-pagebldr-element="header"]',
        );
        return (
          target &&
          header &&
          target.getBoundingClientRect().top >=
            header.getBoundingClientRect().bottom
        );
      },
      undefined,
      { timeout: 2000 },
    );
  },
);
await check(
  "fullscreen navigation traps visible focus and closes with Escape",
  async () => {
    await page.goto(`${origin}/#/capabilities`);
    await page
      .getByLabel("Mobile menu presentation")
      .selectOption("fullscreen");
    const menu = page.locator('[data-pagebldr-element="nav"]');
    const toggle = menu.getByRole("button", { name: "Open navigation" });
    await toggle.click();
    await visible(menu.getByRole("dialog"));
    await menu.locator("summary").first().click();
    for (let index = 0; index < 12; index++) await page.keyboard.press("Tab");
    assert.equal(
      await menu.evaluate((node) => node.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    // Escape closes an inner disclosure first, then the full panel.
    if ((await menu.getAttribute("data-open")) === "true")
      await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("data-open"), "false");
    assert.equal(
      await toggle.evaluate((node) => document.activeElement === node),
      true,
    );
  },
);
await check(
  "independent FAQ groups and native keyboard disclosure",
  async () => {
    const first = page.locator('[data-pagebldr-element="faq-one"] details');
    const second = page.locator('[data-pagebldr-element="faq-two"] details');
    await first.nth(1).locator("summary").focus();
    await first.nth(1).locator("summary").press("Enter");
    assert.notEqual(await first.nth(1).getAttribute("open"), null);
    assert.equal(await first.nth(0).getAttribute("open"), null);
    assert.notEqual(await second.nth(0).getAttribute("open"), null);
  },
);
await check(
  "rich answers: native keyboard, nested groups, mounted forms and multiple-open defaults",
  async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const group = page.locator('[data-pagebldr-element="rich-faq"]');
    const answers = group.locator(":scope > details");
    const first = answers.nth(0);
    const last = answers.nth(1);
    const nested = page.locator(
      '[data-pagebldr-element="nested-faq"] > details',
    );
    await nested.locator("summary").focus();
    await nested.locator("summary").press("Enter");
    assert.notEqual(await nested.getAttribute("open"), null);
    assert.notEqual(await first.getAttribute("open"), null);
    await nested.locator("summary").press("Space");
    assert.equal(await nested.getAttribute("open"), null);
    const form = page.locator('[data-pagebldr-element="accordion-form"] form');
    assert.equal(await form.getByLabel("Email").isVisible(), false);
    await last.locator("summary").focus();
    await last.locator("summary").press("Enter");
    await form.getByLabel("Email").fill("accordion@example.com");
    assert.equal(await first.getAttribute("open"), null);
    await last.locator("summary").press("Space");
    assert.equal(await form.getByLabel("Email").isVisible(), false);
    await last.locator("summary").press("Tab");
    assert.equal(
      await form.evaluate((node) => node.contains(document.activeElement)),
      false,
    );
    await last.locator("summary").press("Enter");
    assert.equal(
      await form.getByLabel("Email").inputValue(),
      "accordion@example.com",
    );
    await form.getByRole("button").click();
    await visible(form.getByText("Request received.", { exact: true }));
    const multiple = page.locator(
      '[data-pagebldr-element="multiple-faq"] > details',
    );
    assert.notEqual(await multiple.nth(0).getAttribute("open"), null);
    assert.notEqual(await multiple.nth(1).getAttribute("open"), null);
    await multiple.nth(0).locator("summary").click();
    assert.notEqual(await multiple.nth(1).getAttribute("open"), null);
    assert.notEqual(await last.getAttribute("open"), null);
    await visible(
      page
        .locator('[data-pagebldr-element="accordion-missing"]')
        .getByRole("status"),
    );
    await page.screenshot({
      path: join(output, "rich-accordion.png"),
      fullPage: true,
    });
  },
);
await check("published accessibility and unique DOM IDs", async () => {
  const ids = await page
    .locator("[id]")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  assert.equal(new Set(ids).size, ids.length);
  const audit = await new AxeBuilder({ page }).analyze();
  await writeFile(
    join(output, "accessibility.json"),
    JSON.stringify(audit.violations, null, 2),
  );
  assert.deepEqual(
    audit.violations
      .filter(({ impact }) => ["serious", "critical"].includes(impact))
      .map(({ id }) => id),
    [],
  );
});
await check(
  "server output without JavaScript exposes every content panel safely",
  async () => {
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(`${origin}/capabilities-ssr`);
    assert.equal(await staticPage.getByRole("tabpanel").count(), 8);
    assert.equal(await staticPage.getByLabel("Email").count(), 3);
    for (const button of await staticPage
      .getByRole("button", { name: "Send request" })
      .all())
      assert.equal(await button.isDisabled(), true);
    const rich = staticPage.locator(
      '[data-pagebldr-element="rich-faq"] > details',
    );
    await rich.nth(1).locator("summary").focus();
    await rich.nth(1).locator("summary").press("Enter");
    assert.equal(await rich.nth(0).getAttribute("open"), null);
    assert.equal(
      await staticPage
        .locator('[data-pagebldr-element="accordion-form"] input')
        .isVisible(),
      true,
    );
    await rich.nth(1).locator("summary").press("Space");
    assert.equal(
      await staticPage
        .locator('[data-pagebldr-element="accordion-form"] input')
        .isVisible(),
      false,
    );
    await staticPage.screenshot({
      path: join(output, "no-javascript.png"),
      fullPage: true,
    });
    await noJs.close();
  },
);
await check(
  "editor selection reveals nested panels; duplication and undo preserve structure",
  async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/#/capabilities`);
    await page.getByRole("button", { name: "edit", exact: true }).click();
    const canvas = page.frameLocator("iframe");
    const enquiry = canvas.getByRole("tab", { name: "Enquire", exact: true });
    await enquiry.click();
    await visible(canvas.locator('[data-pagebldr-selection="enquire"]'));
    await enquiry.press("Home");
    const overview = canvas.getByRole("tab", { name: "Overview", exact: true });
    await visible(canvas.locator('[data-pagebldr-selection="enquire"]'));
    await overview.press("Enter");
    await visible(canvas.locator('[data-pagebldr-selection="overview"]'));
    await page
      .getByRole("tree", { name: "Page structure" })
      .getByRole("button", { name: "enquire", exact: true })
      .click();
    await visible(canvas.locator('[data-pagebldr-element="form"]'));
    await page.getByLabel("Tab label", { exact: true }).fill("Contact");
    await page.getByLabel("Tab label", { exact: true }).press("Tab");
    await visible(canvas.getByRole("tab", { name: "Contact", exact: true }));
    await page
      .getByRole("button", { name: "Reveal nested form", exact: true })
      .click();
    await visible(canvas.locator('[data-pagebldr-element="nested-form"]'));
    assert.equal(await canvas.locator("form").count(), 0);
    await page
      .getByRole("button", { name: "Duplicate enquiry panel", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("iframe")
          ?.contentDocument?.querySelectorAll(
            '[data-pagebldr-element="tabs"] > [role="tablist"] > [role="tab"]',
          ).length === 4,
    );
    const ids = await canvas
      .locator("[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, ids.length);
    await page.getByRole("button", { name: /^Undo/ }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("iframe")
          ?.contentDocument?.querySelectorAll(
            '[data-pagebldr-element="tabs"] > [role="tablist"] > [role="tab"]',
          ).length === 3,
    );
    await visible(canvas.locator('[data-pagebldr-element="nested-form"]'));
    await page.screenshot({
      path: join(output, "nested-editor.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "preview", exact: true })
      .first()
      .click();
    await tabs.nth(1).click();
    await visible(page.locator('[data-pagebldr-element="form"] input'));
  },
);
await check(
  "rich answer editing reveals content, renames questions, duplicates and restores selection",
  async () => {
    await page.getByRole("button", { name: "edit", exact: true }).click();
    const canvas = page.frameLocator("iframe");
    await page
      .getByRole("button", { name: "Reveal accordion form", exact: true })
      .click();
    await visible(canvas.locator('[data-pagebldr-element="accordion-form"]'));
    assert.equal(await canvas.locator("form").count(), 0);
    // Close natively without altering selection, then select its owning panel.
    // The direct child selected in the group remains the same in this case.
    await canvas
      .locator('[data-accordion-panel="rich-enquire"]')
      .evaluate((node) => {
        node.open = false;
      });
    const tree = page.getByRole("tree", { name: "Page structure" });
    await tree
      .getByRole("button", { name: "rich-enquire", exact: true })
      .click();
    await visible(canvas.locator('[data-pagebldr-element="accordion-form"]'));
    await page.getByLabel("Question", { exact: true }).fill("Ask a question");
    await page.getByLabel("Question", { exact: true }).press("Tab");
    await visible(canvas.getByText("Ask a question", { exact: true }));
    await page
      .getByRole("button", { name: "Duplicate accordion answer", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("iframe")
          ?.contentDocument?.querySelectorAll(
            '[data-pagebldr-element="rich-faq"] > details',
          ).length === 3,
    );
    const ids = await canvas
      .locator("[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, ids.length);
    await page.getByRole("button", { name: /^Undo/ }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("iframe")
          ?.contentDocument?.querySelectorAll(
            '[data-pagebldr-element="rich-faq"] > details',
          ).length === 2,
    );
    await visible(canvas.locator('[data-pagebldr-element="accordion-form"]'));
    await page.screenshot({
      path: join(output, "rich-accordion-editor.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "preview", exact: true })
      .first()
      .click();
    await page
      .locator('[data-pagebldr-element="rich-faq"] > details')
      .nth(1)
      .locator("summary")
      .click();
    await visible(
      page.locator('[data-pagebldr-element="accordion-form"] input'),
    );
  },
);
await check(
  "nested menu authoring supports add, indent, outdent and remove",
  async () => {
    await page.getByRole("button", { name: "edit", exact: true }).click();
    const tree = page.getByRole("tree", { name: "Page structure" });
    await tree
      .getByRole("button", { name: "Expand inset", exact: true })
      .click();
    await tree.getByRole("button", { name: "nav", exact: true }).click();
    await page
      .getByRole("button", { name: "Add link", exact: true })
      .last()
      .click();
    await page
      .getByRole("button", { name: "Indent link 2", exact: true })
      .last()
      .click();
    await page
      .getByRole("button", { name: "Outdent link 3", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove link 2", exact: true })
      .last()
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Indent link 2", exact: true })
        .count(),
      1,
    );
  },
);
await check("tab theme fallbacks and scoped style resets", async () => {
  await page.goto(`${origin}/?audit=theme#/capabilities`);
  await page.addStyleTag({
    content:
      ":root { --pagebldr-tab-color: #234567; } [data-pagebldr-renderer] { --pagebldr-focus: #792345; }",
  });
  const heading = tabs.first();
  assert.equal(
    await heading.evaluate((node) => getComputedStyle(node).color),
    "rgb(35, 69, 103)",
  );
  await heading.focus();
  assert.equal(
    await heading.evaluate((node) => getComputedStyle(node).outlineColor),
    "rgb(121, 35, 69)",
  );
  await page.getByRole("button", { name: "edit", exact: true }).click();
  const tree = page.getByRole("tree", { name: "Page structure" });
  await tree.getByRole("button", { name: "tabs", exact: true }).click();
  const inspector = page.getByRole("complementary", {
    name: "Element inspector",
  });
  await inspector.getByRole("tab", { name: "Style", exact: true }).click();
  const state = inspector.getByRole("radiogroup", { name: "Header state" });
  await inspector.getByLabel("Text", { exact: true }).fill("#112233");
  await inspector.getByLabel("Text", { exact: true }).press("Tab");
  await state.getByRole("radio", { name: "Active", exact: true }).click();
  await inspector.getByLabel("Text", { exact: true }).fill("#445566");
  await inspector.getByLabel("Text", { exact: true }).press("Tab");
  await inspector
    .getByRole("button", { name: "Reset Typography section", exact: true })
    .click();
  assert.equal(
    await inspector.getByLabel("Text", { exact: true }).inputValue(),
    "",
  );
  await state.getByRole("radio", { name: "Normal", exact: true }).click();
  assert.equal(
    await inspector.getByLabel("Text", { exact: true }).inputValue(),
    "#112233",
  );
  await inspector
    .getByRole("button", { name: "Reset all local styles", exact: true })
    .click();
  await inspector
    .getByRole("button", { name: "Behaviour", exact: true })
    .click();
  assert.equal(
    await inspector
      .getByLabel("Activation", { exact: true })
      .getAttribute("data-value"),
    "manual",
  );
});
await check(
  "legacy Gallery v2 exposes responsive layout defaults",
  async () => {
    await page.goto(`${origin}/?audit=gallery#/capabilities`);
    await page.getByRole("button", { name: "edit", exact: true }).click();
    const tree = page.getByRole("tree", { name: "Page structure" });
    await tree.getByRole("button", { name: "grid", exact: true }).click();
    const inspector = page.getByRole("complementary", {
      name: "Element inspector",
    });
    await inspector.getByRole("tab", { name: "Style", exact: true }).click();
    for (const [label, value] of [
      ["Desktop columns", "3"],
      ["Tablet columns", "2"],
      ["Mobile columns", "1"],
      ["Gap", "16"],
      ["Image radius", "12"],
    ]) {
      assert.equal(
        await inspector.getByLabel(label, { exact: true }).inputValue(),
        value,
      );
    }
    await inspector.getByLabel("Desktop columns", { exact: true }).fill("4");
    const gallery = page
      .frameLocator("iframe")
      .locator('[data-pagebldr-element="grid"]');
    await visible(gallery.locator('[style*="--gallery-columns: 4"]'));
  },
);
await check(
  "sticky header offset and selection across renderer modes",
  async () => {
    for (const mode of ["published", "preview", "edit"]) {
      await page.goto(`${origin}/?audit=sticky-${mode}#/capabilities`);
      if (mode !== "published")
        await page
          .getByRole("button", { name: mode, exact: true })
          .first()
          .click();
      const surface = mode === "edit" ? page.frameLocator("iframe") : page;
      const header = surface.locator('[data-pagebldr-element="header"]');
      await visible(header);
      if (mode === "edit") {
        await page
          .getByRole("tree", { name: "Page structure" })
          .getByRole("button", { name: "header", exact: true })
          .click();
      }
      const styles = await header.evaluate(async (node) => {
        const view = node.ownerDocument.defaultView;
        const viewport = node.closest("[data-radix-scroll-area-viewport]");
        if (viewport) viewport.scrollTop = 480;
        else view.scrollTo(0, 480);
        await new Promise((resolve) =>
          view.requestAnimationFrame(() => view.requestAnimationFrame(resolve)),
        );
        return {
          scrolled: viewport ? viewport.scrollTop : view.scrollY,
          top: Math.round(
            node.getBoundingClientRect().top -
              (viewport?.getBoundingClientRect().top ?? 0),
          ),
          zIndex: getComputedStyle(node).zIndex,
        };
      });
      assert.ok(styles.scrolled > 150);
      assert.equal(styles.top, 12);
      assert.equal(styles.zIndex, "30");
      if (mode === "edit")
        await visible(surface.locator("[data-pagebldr-selection-outline]"));
    }
  },
);
await context.close();
await browser.close();
await writeFile(
  join(output, "results.json"),
  JSON.stringify({ engine, results, errors }, null, 2),
);
if (results.some(({ status }) => status === "fail") || errors.length) {
  console.error(errors);
  process.exitCode = 1;
}
