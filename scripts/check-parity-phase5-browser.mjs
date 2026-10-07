// Run against an isolated installed Reference Host, never workspace aliases.
// Usage: node scripts/check-parity-phase5-browser.mjs <consumer-dir> <chromium-executable> [evidence-dir]
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import process from "node:process";

const [consumerDirectory, executablePath, evidenceDirectory] =
  process.argv.slice(2);
if (!consumerDirectory || !executablePath)
  throw new Error(
    "Supply the isolated consumer directory and Chromium executable.",
  );
const require = createRequire(join(resolve(consumerDirectory), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(
  evidenceDirectory ??
    "docs/plans/standalone-package/audits/evidence/parity-phase-5/editor-a11y-2026-10-05",
);
await mkdir(output, { recursive: true });
const traceDirectory = resolve(
  process.env.PAGEBLDR_PHASE5_TRACE_DIRECTORY ?? output,
);
await mkdir(traceDirectory, { recursive: true });
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
await page.route("**/phase-five-background.svg", (route) =>
  route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#7659e7"/></svg>',
  }),
);
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
  await page.screenshot({
    path: join(output, `${name}.png`),
    animations: "disabled",
  });
}
async function choose(field, option) {
  await field.click();
  const item =
    typeof option === "object"
      ? page.getByRole("option", { name: option.label, exact: true })
      : page.locator(
          `[role="option"][data-value=${JSON.stringify(String(option))}]`,
        );
  await item.click();
  await page.getByRole("listbox").waitFor({ state: "detached" });
}
async function eventually(read, expected) {
  const deadline = Date.now() + 5000;
  let value;
  do {
    value = await read();
    if (value === expected) return;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  assert.equal(value, expected);
}
async function a11y(name) {
  if (await page.locator("[data-pagebldr-editor]").count()) {
    await check(`${name} editor UI accessibility`, async () => {
      const editorResult = await new AxeBuilder({ page })
        .exclude("iframe")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      await writeFile(
        join(output, `${name}-editor-axe.json`),
        JSON.stringify({ violations: editorResult.violations }, null, 2),
      );
      assert.equal(
        editorResult.violations.length,
        0,
        editorResult.violations
          .map((item) => `${item.id} (${item.nodes.length})`)
          .join(", "),
      );
    });
  }
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
async function setMenuLock(action) {
  if (!(await page.getByRole("tree").isVisible()))
    await page
      .getByRole("button", { name: /^(Open )?Structure$/ })
      .first()
      .click();
  await page
    .getByRole("button", {
      name: "Actions for Project enquiry navigation",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
  await page
    .getByRole("menu", { includeHidden: true })
    .waitFor({ state: "detached" });
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
  await check(
    "Structure leaf spacing is noninteractive and parent arrows remain keyboard-operable",
    async () => {
      const tree = page.getByRole("tree", { name: "Page structure" });
      assert.equal(
        await tree.locator('button[disabled][tabindex="-1"]').count(),
        0,
      );
      const parent = tree.getByRole("button", {
        name: "Header content",
        exact: true,
      });
      await parent.click();
      await parent.press("ArrowLeft");
      assert.equal(
        await tree
          .getByRole("button", { name: "Expand Header content", exact: true })
          .count(),
        1,
      );
      await parent.press("ArrowRight");
      assert.equal(
        await tree
          .getByRole("button", { name: "Collapse Header content", exact: true })
          .count(),
        1,
      );
      await tree
        .getByRole("button", {
          name: "Project enquiry navigation",
          exact: true,
        })
        .click();
    },
  );
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  const menu = () =>
    page
      .frameLocator("iframe")
      .getByRole("navigation", { name: "Primary navigation", exact: true });
  await check("Menu Centre alignment reaches canvas", async () => {
    await page
      .getByRole("radiogroup", { name: "Menu items align", exact: true })
      .getByRole("radio", { name: "Centre", exact: true })
      .click();
    await eventually(
      () =>
        menu()
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
    const slider = page.getByRole("slider", {
      name: "Space between",
      exact: true,
    });
    await slider.press("Home");
    await slider.press("PageUp");
    await slider.press("PageUp");
    await slider.press("PageUp");
    await slider.press("PageUp");
    assert.equal(await slider.getAttribute("aria-valuenow"), "40");
    await eventually(
      () =>
        menu()
          .locator("ul")
          .evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element).gap,
          ),
      "40px",
    );
  });
  await check("Slider changes coalesce into one undoable command", async () => {
    const slider = page.getByRole("slider", {
      name: "Space between",
      exact: true,
    });
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal(await slider.getAttribute("aria-valuenow"), "32");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.equal(await slider.getAttribute("aria-valuenow"), "40");
    await page.getByLabel("Open panel padding", { exact: true }).fill("40");
  });
  await check(
    "Numeric rejection preserves draft with associated error",
    async () => {
      const input = page.getByLabel("Open panel padding", { exact: true });
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
    await page
      .getByLabel("Open panel padding", { exact: true })
      .press("Escape");
    assert.equal(
      await page.getByLabel("Open panel padding", { exact: true }).inputValue(),
      "40",
    );
    assert.equal(
      await page
        .getByLabel("Open panel padding", { exact: true })
        .getAttribute("aria-invalid"),
      null,
    );
  });
  await check(
    "Unsafe responsive Style draft is rejected and Escape clears it",
    async () => {
      const input = page.getByLabel("Colour", { exact: true });
      await input.fill("red;}body{display:none");
      assert.equal(await input.getAttribute("aria-invalid"), "true");
      assert.match(
        await page.getByRole("alert").innerText(),
        /unsafe CSS|valid colour/,
      );
      await input.press("Escape");
      assert.equal(await input.inputValue(), "");
    },
  );
  await check("Menu Style accessibility", () => a11y("menu-style-desktop"));
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await check(
    "Reselecting a scalar option produces no command exception",
    async () => {
      const errorsBefore = diagnostics.pageErrors.length;
      const presentation = page.getByLabel("Collapse style", { exact: true });
      await choose(presentation, await presentation.getAttribute("data-value"));
      await page.waitForTimeout(50);
      assert.equal(diagnostics.pageErrors.length, errorsBefore);
    },
  );
  await check(
    "Menu breakpoint icons are named and keyboard-operable",
    async () => {
      const group = page.getByRole("radiogroup", {
        name: "Menu breakpoint",
        exact: true,
      });
      assert.equal(await group.getByRole("radio").count(), 4);
      const desktop = group.getByRole("radio", {
        name: "Desktop",
        exact: true,
      });
      await desktop.focus();
      await desktop.press("Space");
      assert.equal(await desktop.getAttribute("aria-checked"), "true");
    },
  );
  await choose(
    page.getByLabel("Collapse style", { exact: true }),
    "fullscreen",
  );
  if (
    (await page
      .getByLabel("On breakpoint", { exact: true })
      .getAttribute("data-value")) !== "end"
  )
    await choose(page.getByLabel("On breakpoint", { exact: true }), "end");
  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await check(
    "Fullscreen uses its source contextual alignment label",
    async () => {
      assert.equal(
        await page
          .getByRole("radiogroup", {
            name: "Horizontal alignment",
            exact: true,
          })
          .count(),
        1,
      );
    },
  );
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
  const toggle = publishedMenu.getByRole("button", { includeHidden: true });
  await toggle.click();
  await screenshot("menu-fullscreen-actual-phone");
  await check("Menu fullscreen uses a viewport-fixed panel", async () => {
    const panel = publishedMenu.locator(".pagebldr-menu-panel");
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
        .locator(".pagebldr-menu-list a")
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
    await publishedMenu.locator(".pagebldr-menu-list a").first().hover();
    await page.waitForTimeout(250);
    assert.equal(
      await publishedMenu
        .locator(".pagebldr-menu-list a")
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
  await check(
    "Fullscreen Menu clones the header logo without duplicate Element IDs",
    async () => {
      const clone = publishedMenu.locator(
        ".pagebldr-menu-fullscreen-logo .pagebldr-logo",
      );
      assert.equal(await clone.count(), 1);
      assert.equal(
        await clone.locator("[id], [data-pagebldr-element]").count(),
        0,
      );
      assert.equal(await clone.getAttribute("id"), null);
      assert.equal(await clone.getAttribute("data-pagebldr-element"), null);
      const originalColor = await page
        .locator("[data-pagebldr-element] > .pagebldr-logo-text")
        .first()
        .evaluate(
          (element) =>
            element.ownerDocument.defaultView.getComputedStyle(element).color,
        );
      assert.equal(
        await clone
          .locator(".pagebldr-logo-text")
          .evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element).color,
          ),
        originalColor,
      );
    },
  );
  await check(
    "Fullscreen Menu keyboard focus wraps in both directions",
    async () => {
      const links = publishedMenu.locator(".pagebldr-menu-list a[href]");
      await links.last().focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await toggle.evaluate(
          (element) => element === element.ownerDocument.activeElement,
        ),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await links
          .last()
          .evaluate(
            (element) => element === element.ownerDocument.activeElement,
          ),
        true,
      );
    },
  );
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
  await toggle.click();
  await check("Opening Menu focuses the first navigation link", async () => {
    await page.waitForTimeout(50);
    assert.equal(
      await publishedMenu
        .locator(".pagebldr-menu-list a[href]")
        .first()
        .evaluate((element) => element === element.ownerDocument.activeElement),
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
  await check(
    "Closing fullscreen Menu restores background scrolling and clears its logo",
    async () => {
      assert.notEqual(
        await page
          .locator("body")
          .evaluate((element) => element.style.overflow),
        "hidden",
      );
      assert.equal(
        await publishedMenu
          .locator(".pagebldr-menu-fullscreen-logo")
          .innerHTML(),
        "",
      );
    },
  );

  await fresh();
  await select("Project enquiry navigation", "Header content");
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Menu breakpoint", exact: true })
    .getByRole("radio", { name: "Tablet", exact: true })
    .click();
  await choose(page.getByLabel("Collapse style", { exact: true }), "dropdown");
  await page
    .getByRole("link", { name: "Open published rendering", exact: true })
    .click();
  await page.setViewportSize({ width: 820, height: 1000 });
  await toggle.click();
  await check(
    "Dropdown opens below the nearest header boundary without locking scrolling",
    async () => {
      const layout = await publishedMenu.evaluate((menu) => {
        const panel = menu.querySelector(".pagebldr-menu-panel");
        const boundary =
          menu.parentElement.closest("header, section, footer, article") ??
          menu.parentElement.closest("[data-pagebldr-element]") ??
          menu;
        const view = menu.ownerDocument.defaultView;
        return {
          top: panel.getBoundingClientRect().top,
          bottom: Math.max(0, boundary.getBoundingClientRect().bottom),
          position: view.getComputedStyle(panel).position,
          overflow: menu.ownerDocument.body.style.overflow,
        };
      });
      assert.equal(layout.position, "fixed");
      assert.ok(
        Math.abs(layout.top - layout.bottom) < 2,
        JSON.stringify(layout),
      );
      assert.notEqual(layout.overflow, "hidden");
      await screenshot("menu-dropdown-tablet");
    },
  );
  await check(
    "Selecting a Menu anchor closes its panel and focuses the destination",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const link = publishedMenu
        .locator('.pagebldr-menu-list a[href^="#"]')
        .first();
      const href = await link.getAttribute("href");
      await link.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.id),
        decodeURIComponent(href.slice(1)),
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
    },
  );
  await page.evaluate(() => globalThis.window.scrollTo(0, 0));
  await toggle.click();
  await check(
    "Crossing the collapse breakpoint closes Menu and restores its inline layout",
    async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(100);
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await toggle.isVisible(), false);
      assert.equal(
        await publishedMenu
          .locator(".pagebldr-menu-panel")
          .evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element)
                .position,
          ),
        "static",
      );
      assert.equal(
        await publishedMenu
          .locator("ul")
          .evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element)
                .flexDirection,
          ),
        "row",
      );
    },
  );

  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1000],
    ["phone", 390, 844],
  ]) {
    await check(
      `Collection invalid drafts and keyboard recovery ${name}`,
      async () => {
        await fresh(width, height);
        await select("Project enquiry navigation", "Header content");
        await page.getByRole("tab", { name: "Content", exact: true }).click();
        await screenshot(`menu-content-icons-${name}`);
        const input = page.getByLabel("Label", { exact: true }).first();
        const original = await input.inputValue();
        await input.fill("");
        await input.press("Enter");
        assert.equal(await input.inputValue(), "");
        assert.equal(await input.getAttribute("aria-invalid"), "true");
        const errorId = await input.getAttribute("aria-describedby");
        assert.match(
          await page.locator(`[id="${errorId}"]`).innerText(),
          /Enter label/,
        );
        await page.locator(`[id="${errorId}"]`).scrollIntoViewIfNeeded();
        await screenshot(`collection-invalid-${name}`);
        await check(`Collection revealed error accessibility ${name}`, () =>
          a11y(`collection-invalid-${name}`),
        );
        await input.press("Escape");
        assert.equal(await input.inputValue(), original);
        await input.fill("x".repeat(201));
        await input.press("Tab");
        assert.equal(await input.getAttribute("aria-invalid"), "true");
        assert.equal(await input.inputValue(), "x".repeat(201));
        await input.press("Escape");
        await input.fill("Browser navigation");
        await input.press("Enter");
        assert.equal(
          await page
            .frameLocator("iframe")
            .getByRole("navigation", {
              name: "Primary navigation",
              exact: true,
            })
            .locator(".pagebldr-menu-list a")
            .first()
            .innerText(),
          "Browser navigation",
        );
        // Menu item drafts use their parent collection's prop coalescing policy.
        await page.keyboard.press("Control+z");
        assert.equal(await input.inputValue(), original);
        assert.equal(await input.getAttribute("aria-invalid"), null);
        await check(
          `Menu slider keyboard bounds and undo ${name}`,
          async () => {
            await page.getByRole("tab", { name: "Style", exact: true }).click();
            const slider = page.getByRole("slider", {
              name: "Space between",
              exact: true,
            });
            await slider.press("End");
            assert.equal(await slider.getAttribute("aria-valuenow"), "96");
            await slider.press("Home");
            assert.equal(await slider.getAttribute("aria-valuenow"), "0");
            await slider.press("ArrowRight");
            assert.equal(await slider.getAttribute("aria-valuenow"), "1");
            await screenshot(`menu-slider-keyboard-${name}`);
            await page.keyboard.press("Control+z");
            assert.equal(await slider.getAttribute("aria-valuenow"), "32");
            await page
              .getByRole("tab", { name: "Content", exact: true })
              .click();
          },
        );
        await check(
          `Locked definition controls cannot mutate props ${name}`,
          async () => {
            await setMenuLock("Lock");
            assert.equal(await input.isDisabled(), true);
            const breakpoint = page.getByRole("radiogroup", {
              name: "Menu breakpoint",
              exact: true,
            });
            assert.equal(
              await breakpoint
                .getByRole("radio", { name: "Desktop", exact: true })
                .isDisabled(),
              true,
            );
            await page.getByRole("tab", { name: "Style", exact: true }).click();
            const slider = page.getByRole("slider", {
              name: "Space between",
              exact: true,
            });
            assert.equal(await slider.getAttribute("tabindex"), null);
            assert.notEqual(await slider.getAttribute("data-disabled"), null);
            await page
              .getByRole("tab", { name: "Content", exact: true })
              .click();
            await setMenuLock("Unlock");
          },
        );
      },
    );
    await check(`Collection validation accessibility ${name}`, () =>
      a11y(`collection-validation-${name}`),
    );
    await check(
      `Rich Text rejected drafts never change rendered content ${name}`,
      async () => {
        await select("Hero enquiry promise", ["Hero content", "Hero message"]);
        await page.getByRole("tab", { name: "Content", exact: true }).click();
        const input = page.getByLabel("Text", { exact: true }).first();
        const original = await input.inputValue();
        await input.fill("x".repeat(10001));
        assert.equal(await input.getAttribute("aria-invalid"), "true");
        assert.equal((await input.inputValue()).length, 10001);
        const rendered = page
          .frameLocator("iframe")
          .locator('[data-pagebldr-element="reference-rich-text-9"]');
        assert.equal(await rendered.innerText(), original);
        await page
          .locator(`[id="${await input.getAttribute("aria-describedby")}"]`)
          .scrollIntoViewIfNeeded();
        await screenshot(`rich-text-invalid-${name}`);
        await check(`Rich Text revealed error accessibility ${name}`, () =>
          a11y(`rich-text-invalid-${name}`),
        );
        await input.press("Escape");
        assert.equal(await input.inputValue(), original);
        await input.fill("Browser rich text");
        assert.equal(await rendered.innerText(), "Browser rich text");
        await page.keyboard.press("Control+z");
        assert.equal(await input.inputValue(), original);
        assert.equal(await input.getAttribute("aria-invalid"), null);
      },
    );
    await check(`Rich Text validation accessibility ${name}`, () =>
      a11y(`rich-text-validation-${name}`),
    );
  }

  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["phone", 390, 844],
  ]) {
    await check(`Heading Content journey ${name}`, async () => {
      await fresh(width, height);
      await select("Page title", ["Hero content", "Hero message"]);
      const level = page.getByLabel("HTML level", { exact: true });
      await choose(level, "2");
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
      await page.getByLabel("Padding top", { exact: true }).fill("32");
      assert.equal(
        await page.getByLabel("Padding top", { exact: true }).inputValue(),
        "32",
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
      await choose(
        page.getByRole("combobox", {
          name: "Authored breakpoint",
          exact: true,
        }),
        "tablet",
      );
      await page.getByRole("radio", { name: "Hover", exact: true }).click();
      await page.getByLabel("Colour", { exact: true }).fill("#112233");
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
        .getByRole("button", { name: "Reset Colour", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Colour", { exact: true }).inputValue(),
        "",
      );
    },
  );
  await check("Container Tablet Hover accessibility", () =>
    a11y("container-style-tablet-hover-desktop"),
  );

  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1000],
    ["phone", 390, 844],
  ]) {
    await check(
      `Menu colour picker has no opening or format-change mutation ${name}`,
      async () => {
        await fresh(width, height);
        await select("Project enquiry navigation", "Header content");
        await page.getByRole("tab", { name: "Style", exact: true }).click();
        const input = page.getByLabel("Menu background", { exact: true });
        const original = await input.inputValue();
        const trigger = page.getByRole("button", {
          name: "Choose menu background colour",
          exact: true,
        });
        await trigger.focus();
        await trigger.press("Enter");
        const popup = page.getByRole("dialog", {
          name: "Menu background colour",
          exact: true,
        });
        await popup.waitFor();
        assert.equal(
          await popup
            .getByRole("slider", { name: "Opacity", exact: true })
            .count(),
          0,
        );
        await choose(popup.getByLabel("Colour format", { exact: true }), "rgb");
        assert.equal(await input.inputValue(), original);
        await screenshot(`menu-colour-open-${name}`);
        await check(`Menu revealed colour popover accessibility ${name}`, () =>
          a11y(`menu-colour-open-${name}`),
        );
        await popup.getByLabel("Colour value", { exact: true }).press("Escape");
        await popup.waitFor({ state: "detached" });
        assert.equal(await popup.count(), 0);
        assert.equal(
          await trigger.evaluate((el) => el === el.ownerDocument.activeElement),
          true,
        );
        assert.equal(await input.inputValue(), original);
      },
    );
    await check(
      `Menu colour text and selection keyboard editing ${name}`,
      async () => {
        const input = page.getByLabel("Menu background", { exact: true });
        const original = await input.inputValue();
        await input.fill("invalid");
        assert.equal(await input.getAttribute("aria-invalid"), "true");
        await input.press("Escape");
        assert.equal(await input.inputValue(), original);
        await input.fill("rgba(18, 52, 86, 0.5)");
        assert.equal(await input.inputValue(), "#123456");
        await page
          .getByRole("button", {
            name: "Choose menu background colour",
            exact: true,
          })
          .click();
        const popup = page.getByRole("dialog", {
          name: "Menu background colour",
          exact: true,
        });
        const square = popup.getByRole("button", {
          name: "Colour saturation and brightness",
          exact: true,
        });
        await square.press("ArrowRight");
        const changed = await input.inputValue();
        assert.notEqual(changed, "#123456");
        await square.press("Shift+ArrowUp");
        assert.notEqual(await input.inputValue(), changed);
        const keyboardColour = await input.inputValue();
        await square.click({ position: { x: 30, y: 60 } });
        assert.notEqual(await input.inputValue(), keyboardColour);
        await square.press("Escape");
        await page.keyboard.press("Control+z");
        assert.equal(await input.inputValue(), original);
      },
    );
    await check(
      `Responsive colour opacity, reset and variable binding ${name}`,
      async () => {
        await select("Hero");
        await page.getByRole("tab", { name: "Style", exact: true }).click();
        const input = page.getByLabel("Colour", { exact: true });
        await page
          .getByRole("button", {
            name: "Choose Colour value source",
            exact: true,
          })
          .click();
        await choose(
          page.getByRole("combobox", {
            name: "Colour value source",
            exact: true,
          }),
          "custom",
        );
        await page
          .getByRole("button", {
            name: "Choose Colour value source",
            exact: true,
          })
          .click();
        await input.fill("#123456");
        await page
          .getByRole("button", {
            name: "Choose colour colour",
            exact: true,
          })
          .click();
        const popup = page.getByRole("dialog", {
          name: "Colour colour",
          exact: true,
        });
        const opacity = popup.getByRole("slider", {
          name: "Opacity",
          exact: true,
        });
        await opacity.press("Home");
        await opacity.press("PageUp");
        assert.match(await input.inputValue(), /^rgba\(18, 52, 86, 0\.1\)$/);
        await screenshot(`style-colour-alpha-${name}`);
        await check(`Responsive colour opacity accessibility ${name}`, () =>
          a11y(`style-colour-alpha-${name}`),
        );
        await opacity.press("Escape");
        await page
          .getByRole("button", { name: "Reset Colour", exact: true })
          .click();
        assert.equal(await input.inputValue(), "");
        await page
          .getByRole("button", {
            name: "Choose Colour value source",
            exact: true,
          })
          .click();
        const source = page.getByRole("combobox", {
          name: "Colour value source",
          exact: true,
        });
        await source.click();
        const variableId = await page
          .locator('[role="option"]:not([data-value="custom"])')
          .first()
          .getAttribute("data-value");
        await page.getByRole("listbox").press("Escape");
        await page.getByRole("listbox").waitFor({ state: "detached" });
        await choose(source, variableId);
        await page
          .getByRole("button", {
            name: "Choose Colour value source",
            exact: true,
          })
          .click();
        assert.equal(await input.isDisabled(), true);
        assert.equal(
          await page
            .getByRole("button", {
              name: "Choose colour colour",
              exact: true,
            })
            .isDisabled(),
          true,
        );
      },
    );
    await check(
      `Page design colour Variable opacity and undo ${name}`,
      async () => {
        await page
          .getByRole("button", { name: "More editor actions", exact: true })
          .click();
        await page
          .getByRole("menuitem", { name: "Page design", exact: true })
          .click();
        await page.getByRole("tab", { name: "Variables", exact: true }).click();
        await page
          .getByLabel("Add variable", { exact: true })
          .fill("Picker accent");
        await page.getByLabel("Add variable", { exact: true }).press("Enter");
        const input = page.getByLabel("Picker accent value", { exact: true });
        const original = await input.inputValue();
        await page
          .getByRole("button", {
            name: "Choose picker accent value colour",
            exact: true,
          })
          .click();
        const popup = page.getByRole("dialog", {
          name: "Picker accent value colour",
          exact: true,
        });
        const opacity = popup.getByRole("slider", {
          name: "Opacity",
          exact: true,
        });
        await opacity.press("Home");
        assert.match(await input.inputValue(), /^#[\da-f]{6}00$/i);
        await screenshot(`variable-colour-alpha-${name}`);
        await check(
          `Page design colour Variable popover accessibility ${name}`,
          () => a11y(`variable-colour-alpha-${name}`),
        );
        await opacity.press("Escape");
        await page.keyboard.press("Control+z");
        assert.equal(await input.inputValue(), original);
      },
    );
  }
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ]) {
    await check(`Composed Typography controls ${name}`, async () => {
      await fresh(width, height);
      await select("Page title", ["Hero content", "Hero message"]);
      await page.getByRole("tab", { name: "Style", exact: true }).click();
      const font = page.getByLabel("Font family", { exact: true });
      await font.click();
      assert.ok((await page.getByRole("option").count()) >= 11);
      await page.getByRole("listbox").press("Escape");
      await page.getByRole("listbox").waitFor({ state: "detached" });
      await choose(font, { label: "Inter" });
      await choose(page.getByLabel("Size unit", { exact: true }), "px");
      await page.getByLabel("Size", { exact: true }).fill("32");
      await choose(page.getByLabel("Weight", { exact: true }), "700");
      await page
        .locator('[aria-label="Alignment"]')
        .getByRole("radio", { name: "Centre", exact: true })
        .click();
      const heading = page
        .frameLocator("iframe")
        .locator('[data-pagebldr-element="reference-heading-8"]');
      const style = await heading.evaluate((el) => ({
        size: el.ownerDocument.defaultView.getComputedStyle(el).fontSize,
        weight: el.ownerDocument.defaultView.getComputedStyle(el).fontWeight,
        align: el.ownerDocument.defaultView.getComputedStyle(el).textAlign,
      }));
      assert.deepEqual(style, { size: "32px", weight: "700", align: "center" });
      await screenshot(`composed-typography-${name}`);
      await check(`Composed Typography accessibility ${name}`, () =>
        a11y(`composed-typography-${name}`),
      );
    });
    await check(
      `Background layers and rejected image draft ${name}`,
      async () => {
        await fresh(width, height);
        await select("Hero");
        await page.getByRole("tab", { name: "Style", exact: true }).click();
        const layers = page.locator('[aria-label="Background layers"]');
        await layers
          .getByRole("radio", { name: "Gradient", exact: true })
          .click();
        const angle = page.getByLabel("Gradient angle", { exact: true });
        await angle.fill("361");
        assert.equal(await angle.getAttribute("aria-invalid"), "true");
        await angle.press("Escape");
        assert.equal(await angle.inputValue(), "135");
        await layers
          .getByRole("radio", { name: "Overlay", exact: true })
          .click();
        const image = page.getByLabel("Background image URL", { exact: true });
        await image.fill("javascript:alert(1)");
        await image.press("Tab");
        assert.equal(await image.getAttribute("aria-invalid"), "true");
        await screenshot(`background-invalid-${name}`);
        await check(`Background error accessibility ${name}`, () =>
          a11y(`background-invalid-${name}`),
        );
        await image.press("Escape");
        await image.fill("http://127.0.0.1:5173/phase-five-background.svg");
        await image.press("Tab");
        const background = await page
          .frameLocator("iframe")
          .locator('[data-pagebldr-element="reference-container-15"]')
          .evaluate(
            (el) =>
              el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage,
          );
        assert.match(background, /linear-gradient/);
        assert.match(background, /phase-five-background\.svg/);
        await page
          .getByRole("button", {
            name: "Reset Background section",
            exact: true,
          })
          .click();
        assert.equal(
          await layers
            .getByRole("radio", { name: "None", exact: true })
            .getAttribute("aria-checked"),
          "true",
        );
      },
    );
    await check(
      `Linked spacing, effects, visibility and anchor recovery ${name}`,
      async () => {
        await fresh(width, height);
        await select("Hero");
        await page.getByRole("tab", { name: "Advanced", exact: true }).click();
        const anchor = page.getByLabel("ID", { exact: true });
        const original = await anchor.inputValue();
        await anchor.fill("approach");
        assert.equal(await anchor.getAttribute("aria-invalid"), "true");
        await anchor.press("Escape");
        assert.equal(await anchor.inputValue(), original);
        await choose(
          page.getByLabel("Padding top unit", { exact: true }),
          "px",
        );
        await page.getByLabel("Padding top", { exact: true }).fill("24");
        for (const side of ["Top", "Right", "Bottom", "Left"])
          assert.equal(
            await page
              .getByLabel(`Padding ${side.toLowerCase()}`, { exact: true })
              .inputValue(),
            "24",
          );
        await page
          .getByRole("button", { name: "Add transform", exact: true })
          .click();
        const scale = page.getByLabel("Transform Scale", { exact: true });
        await scale.fill("-1");
        await scale.press("Tab");
        assert.equal(await scale.getAttribute("aria-invalid"), "true");
        await scale.press("Escape");
        assert.equal(await scale.inputValue(), "1");
        await page
          .getByRole("button", { name: "Add filter", exact: true })
          .click();
        await page.getByLabel("Filter Blur", { exact: true }).fill("2");
        await page.getByLabel("Filter Blur", { exact: true }).press("Enter");
        await page
          .getByRole("button", { name: "Responsive visibility", exact: true })
          .click();
        await page
          .getByRole("switch", { name: "Hide on Mobile", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("switch", { name: "Hide on Mobile", exact: true })
            .isChecked(),
          true,
        );
        await page.keyboard.press("Control+z");
        assert.equal(
          await page
            .getByRole("switch", { name: "Hide on Mobile", exact: true })
            .isChecked(),
          false,
        );
        await screenshot(`composed-advanced-${name}`);
        await check(`Composed Advanced accessibility ${name}`, () =>
          a11y(`composed-advanced-${name}`),
        );
        await page
          .getByRole("button", { name: "Reset Effects section", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Add transform", exact: true })
            .count(),
          1,
        );
      },
    );
    await check(
      `Page design rejected numeric drafts block Apply and recover ${name}`,
      async () => {
        await fresh(width, height);
        await page
          .getByRole("button", { name: "More editor actions", exact: true })
          .click();
        await page
          .getByRole("menuitem", { name: "Page design", exact: true })
          .click();
        const input = page.getByLabel("Content width", { exact: true });
        const apply = page.getByRole("button", {
          name: "Apply page design",
          exact: true,
        });
        const original = await input.inputValue();
        await input.fill("300");
        assert.equal(await input.getAttribute("aria-invalid"), "true");
        assert.equal(await apply.isDisabled(), true);
        await screenshot(`page-design-invalid-${name}`);
        await check(`Page design error accessibility ${name}`, () =>
          a11y(`page-design-invalid-${name}`),
        );
        await input.press("Escape");
        assert.equal(await input.inputValue(), original);
        assert.equal(await apply.isEnabled(), true);
        assert.equal(
          await page
            .getByRole("dialog", { name: "Page design", exact: true })
            .isVisible(),
          true,
        );
        await input.fill("");
        assert.equal(await apply.isDisabled(), true);
        await page
          .getByRole("button", { name: "Reset design defaults", exact: true })
          .focus();
        await page
          .getByRole("button", { name: "Reset design defaults", exact: true })
          .press("Enter");
        assert.equal(await input.inputValue(), "1200");
        assert.equal(await apply.isEnabled(), true);
        await page
          .getByRole("tab", { name: "SEO & social", exact: true })
          .click();
        const title = page
          .getByRole("dialog", { name: "Page design", exact: true })
          .getByLabel("Page title", { exact: true });
        await title.fill(" ");
        await title.press("Tab");
        assert.equal(await title.getAttribute("aria-invalid"), "true");
        assert.equal(await apply.isDisabled(), true);
        await title.press("Escape");
        assert.equal(
          await page
            .getByRole("dialog", { name: "Page design", exact: true })
            .isVisible(),
          true,
        );
        assert.equal(await apply.isEnabled(), true);
        await page
          .getByLabel("Search title", { exact: true })
          .fill("Inspector search title");
        await apply.click();
      },
    );
  }
  const { standardElements } = await import(
    pathToFileURL(
      join(resolve(consumerDirectory), "node_modules/pagebldr/dist/index.js"),
    ).href
  );
  const allElements = JSON.parse(
    await readFile(
      join(
        resolve(consumerDirectory),
        "fixtures/parity/all-elements.document.json",
      ),
      "utf8",
    ),
  );
  const fieldEvidence = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/#/editor/elements");
  await page.reload();
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor();
  for (const definition of standardElements) {
    for (const [section, controls] of [
      ["Content", definition.controls ?? []],
      ["Style", definition.styleControls ?? []],
    ]) {
      if (section === "Style" && controls.length === 0) continue;
      await check(
        `All-Elements ${section} field presentation ${definition.type}`,
        async () => {
          const element = Object.values(allElements.elements).find(
            (element) => element.type === definition.type,
          );
          await select(element.name);
          await page.getByRole("tab", { name: section, exact: true }).click();
          for (const control of controls) {
            const matches = (condition) =>
              condition.equals !== undefined
                ? element.props[condition.key] === condition.equals
                : element.props[condition.key] !== condition.notEquals;
            const conditions = control.visibleWhen
              ? Array.isArray(control.visibleWhen)
                ? control.visibleWhen
                : [control.visibleWhen]
              : [];
            if (!conditions.every(matches)) continue;
            const label =
              control.labelWhen?.find((item) => item.conditions.every(matches))
                ?.label ?? control.label;
            if (
              !["text", "number", "select", "boolean"].includes(control.kind)
            ) {
              fieldEvidence.push({
                element: definition.type,
                property: control.key,
                kind: control.kind,
                sharedComposition: true,
                section,
              });
              continue;
            }
            const field =
              control.kind === "select" &&
              control.presentation &&
              control.presentation !== "select"
                ? page.getByRole("radiogroup", { name: label, exact: true })
                : control.kind === "number" && control.presentation === "slider"
                  ? page.getByRole("slider", { name: label, exact: true })
                  : page.getByLabel(label, { exact: true });
            assert.equal(
              await field.count(),
              1,
              `${definition.type}.${control.key} has one named control`,
            );
            await field.scrollIntoViewIfNeeded();
            const box = await field.boundingBox();
            assert.ok(
              box?.width > 0 && box?.height > 0,
              `${definition.type}.${control.key} has visible geometry`,
            );
            if (
              control.kind !== "select" ||
              !control.presentation ||
              control.presentation === "select"
            )
              await field.focus();
            fieldEvidence.push({
              element: definition.type,
              property: control.key,
              kind: control.kind,
              section,
              presentation: control.presentation ?? "default",
              label,
              width: box.width,
              height: box.height,
            });
          }
          const viewport = page
            .getByRole("tabpanel", { name: section, exact: true })
            .locator("[data-radix-scroll-area-viewport]");
          await viewport.evaluate((el) => {
            el.scrollTop = 0;
          });
          await screenshot(
            `all-elements-${section.toLowerCase()}-${definition.type}`,
          );
        },
      );
      await check(
        `All-Elements ${section} accessibility ${definition.type}`,
        () => a11y(`all-elements-${section.toLowerCase()}-${definition.type}`),
      );
    }
  }
  await check("Size-only Spacer Width stays in Layout", async () => {
    const spacer = Object.values(allElements.elements).find(
      (element) => element.type === "spacer",
    );
    await select(spacer.name);
    await page.getByRole("tab", { name: "Advanced", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Reset Layout section", exact: true })
        .count(),
      1,
    );
    assert.equal(await page.getByLabel("Display", { exact: true }).count(), 0);
    await page.getByLabel("Width", { exact: true }).focus();
    await page
      .getByRole("tabpanel", { name: "Advanced", exact: true })
      .locator("[data-radix-scroll-area-viewport]")
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    await screenshot("spacer-advanced-layout-desktop");
  });
  await check("Size-only Spacer accessibility", () =>
    a11y("spacer-advanced-layout-desktop"),
  );
  await writeFile(
    join(output, "content-field-matrix.json"),
    JSON.stringify(fieldEvidence, null, 2),
  );
} finally {
  await context.tracing.stop({
    path: join(traceDirectory, "phase5-browser-trace.zip"),
  });
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        artifact,
        tracePath: join(traceDirectory, "phase5-browser-trace.zip"),
        browser: browser.version(),
        viewports: [
          { width: 1440, height: 900 },
          { width: 820, height: 1000 },
          { width: 820, height: 1180 },
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
