// Exhaustive installed inspector presentation/keyboard inventory, including conditional states.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";

const [consumer, executablePath, directory] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { standardElements } = await import(
  pathToFileURL(join(resolve(consumer), "node_modules/pagebldr/dist/index.js"))
    .href
);
const fixture = JSON.parse(
  await readFile(
    join(consumer, "fixtures/parity/all-elements.document.json"),
    "utf8",
  ),
);
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const output = resolve(directory);
await mkdir(output, { recursive: true });
const results = [];
const fields = [];
const contracts = [];
const keyboardCases = new Set();
const pageErrors = [];
let activeField = null;
page.on("pageerror", (error) =>
  pageErrors.push({ message: error.message, stack: error.stack, activeField }),
);
page.setDefaultTimeout(5000);

async function selectElement(name, narrow) {
  if (await page.getByRole("listbox").count()) {
    await page.getByRole("listbox").press("Escape");
    await page.getByRole("listbox").waitFor({ state: "detached" });
  }
  if (!(await page.getByRole("tree").isVisible()))
    await page
      .getByRole("button", { name: /^(Open )?Structure$/ })
      .first()
      .click();
  await page
    .getByRole("tree")
    .getByRole("button", { name, exact: true })
    .click();
  if (narrow)
    await page
      .getByRole("button", { name: "Close Structure", exact: true })
      .first()
      .click();
}
async function choose(label, value) {
  const field = page.getByLabel(label, { exact: true });
  if (
    (await field.count()) &&
    (await field.getAttribute("role")) === "combobox"
  ) {
    if ((await field.getAttribute("data-value")) === String(value)) return;
    await field.click();
    await page
      .locator(`[role="option"][data-value=${JSON.stringify(String(value))}]`)
      .click();
    await page.getByRole("listbox").waitFor({ state: "detached" });
  } else {
    const group = page.getByRole("radiogroup", { name: label, exact: true });
    const control = standardElements
      .flatMap((definition) => [
        ...(definition.controls ?? []),
        ...(definition.styleControls ?? []),
      ])
      .find((control) => control.label === label);
    const option = control.options.find(
      (option) => String(option.value) === String(value),
    );
    await group.getByRole("radio", { name: option.label, exact: true }).click();
  }
}
async function assertDefinitionFields(
  definition,
  section,
  props,
  scenario,
  width,
) {
  const controls =
    section === "Content"
      ? (definition.controls ?? [])
      : (definition.styleControls ?? []);
  const scope =
    section === "Style"
      ? page
          .getByRole("tabpanel", { name: section, exact: true })
          .locator('[data-slot="field-group"]')
          .filter({ hasText: "Visual options specific to this Element." })
          .first()
      : page.getByRole("tabpanel", { name: section, exact: true });
  const matches = (condition) =>
    condition.equals !== undefined
      ? props[condition.key] === condition.equals
      : props[condition.key] !== condition.notEquals;
  for (const control of controls) {
    const conditions = control.visibleWhen
      ? Array.isArray(control.visibleWhen)
        ? control.visibleWhen
        : [control.visibleWhen]
      : [];
    const visible = conditions.every(matches);
    const label =
      control.labelWhen?.find((entry) => entry.conditions.every(matches))
        ?.label ?? control.label;
    const field =
      control.kind === "destination"
        ? scope.getByLabel(`${label} type`, { exact: true })
        : ["collection", "rich-text"].includes(control.kind)
          ? scope.getByRole("group", { name: label, exact: true })
          : control.kind === "select" &&
              control.presentation &&
              control.presentation !== "select"
            ? scope.getByRole("radiogroup", { name: label, exact: true })
            : control.kind === "number" && control.presentation === "slider"
              ? scope.getByRole("slider", { name: label, exact: true })
              : scope.getByLabel(label, { exact: true });
    assert.equal(
      await field.count(),
      visible ? 1 : 0,
      `${definition.type}.${control.key} matches its visible field contract`,
    );
    contracts.push({
      element: definition.type,
      section,
      scenario,
      width,
      property: control.key,
      kind: control.kind,
      label,
      visible,
    });
  }
}
async function inspect(section, element, scenario, width) {
  const panel = page.getByRole("tabpanel", { name: section, exact: true });
  const controls = panel.locator(
    'input:not([type="hidden"]), textarea, button[role="combobox"], button[role="switch"], [role="slider"], button[role="radio"]',
  );
  for (let index = 0; index < (await controls.count()); index++) {
    const field = controls.nth(index);
    if (!(await field.isVisible()) || (await field.isDisabled())) continue;
    await field.scrollIntoViewIfNeeded();
    const info = await field.evaluate((el) => ({
      label:
        el.getAttribute("aria-label") ||
        [...globalThis.document.querySelectorAll("label")]
          .find((label) => label.htmlFor === el.id)
          ?.textContent?.trim() ||
        el.closest('[role="radiogroup"]')?.getAttribute("aria-label"),
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      property: el
        .closest("[data-style-property]")
        ?.getAttribute("data-style-property"),
      min: el.getAttribute("aria-valuemin"),
      max: el.getAttribute("aria-valuemax"),
      value: el.getAttribute("aria-valuenow"),
    }));
    assert.ok(
      info.label,
      `${element} ${section} field ${index} has an accessible label`,
    );
    const box = await field.boundingBox();
    assert.ok(
      box.width > 0 &&
        box.height > 0 &&
        box.x >= 0 &&
        box.x + box.width <= width + 1,
      `${info.label} fits its viewport`,
    );
    const keyboardCase = `${width}:${info.property || element}:${info.label}:${info.role}`;
    activeField = { element, section, scenario, width, ...info };
    if (keyboardCases.has(keyboardCase)) {
      fields.push({
        element,
        section,
        scenario,
        width,
        ...info,
        box,
        keyboardCase,
      });
      continue;
    }
    await field.focus();
    assert.ok(
      await field.evaluate((el) => el === globalThis.document.activeElement),
      `${info.label} accepts keyboard focus`,
    );
    if (info.role === "combobox") {
      await field.press("Enter");
      assert.ok(
        await page.getByRole("listbox").isVisible(),
        `${info.label} reveals choices by keyboard`,
      );
      await page.getByRole("listbox").press("Escape");
      await page.getByRole("listbox").waitFor({ state: "detached" });
      assert.ok(
        await field.evaluate((el) => el === globalThis.document.activeElement),
        `${info.label} restores focus`,
      );
    } else if (info.role === "switch") {
      const before = await field.getAttribute("aria-checked");
      await field.press("Space");
      await field.press("Space");
      assert.equal(await field.getAttribute("aria-checked"), before);
    } else if (info.role === "slider") {
      const backwards = Number(info.value) >= Number(info.max);
      await field.press(backwards ? "ArrowLeft" : "ArrowRight");
      await field.press(backwards ? "ArrowRight" : "ArrowLeft");
      assert.equal(await field.getAttribute("aria-valuenow"), info.value);
    } else if (info.role === "input" || info.role === "textarea") {
      await field.press("End");
      if (info.role === "input") await field.press("Enter");
      await field.press("Tab");
    }
    keyboardCases.add(keyboardCase);
    fields.push({
      element,
      section,
      scenario,
      width,
      ...info,
      box,
      keyboardCase,
    });
  }
  const viewport = panel.locator("[data-radix-scroll-area-viewport]").first();
  if (await viewport.count())
    await viewport.evaluate((el) => {
      el.scrollTop = 0;
    });
  await page.screenshot({
    path: join(
      output,
      `${element}-${section.toLowerCase()}-${scenario}-${width}.png`,
    ),
    animations: "disabled",
  });
}

try {
  for (const [width, height] of [
    [1440, 900],
    [820, 1180],
    [390, 844],
  ]) {
    if (
      process.env.PAGEBLDR_PHASE5_FIELD_WIDTH &&
      String(width) !== process.env.PAGEBLDR_PHASE5_FIELD_WIDTH
    )
      continue;
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:5173/#/editor/elements");
    await page.reload();
    await page
      .frameLocator("iframe")
      .locator("[data-pagebldr-renderer]")
      .waitFor();
    await selectElement(fixture.elements[fixture.rootId].name, width < 768);
    await page.getByRole("tab", { name: "Advanced", exact: true }).click();
    await page.getByLabel("ID", { exact: true }).fill("field-gate-root");
    await page.getByLabel("ID", { exact: true }).press("Enter");
    for (const definition of standardElements) {
      if (
        process.env.PAGEBLDR_PHASE5_FIELD_ELEMENT &&
        definition.type !== process.env.PAGEBLDR_PHASE5_FIELD_ELEMENT
      )
        continue;
      const element = Object.values(fixture.elements).find(
        (element) => element.type === definition.type,
      );
      const scenarios =
        definition.type === "logo"
          ? ["text", "image", "image-text"]
          : definition.type === "menu"
            ? ["never", "dropdown", "fullscreen", "background"]
            : definition.type === "button"
              ? [
                  "default",
                  "external",
                  "anchor",
                  "email",
                  "telephone",
                  "application",
                ]
              : ["default"];
      for (const scenario of scenarios) {
        try {
          await selectElement(element.name, width < 768);
          await page.getByRole("tab", { name: "Content", exact: true }).click();
          if (definition.type === "logo")
            await choose("Logo display", scenario);
          if (definition.type === "menu") {
            await choose(
              "Menu breakpoint",
              scenario === "never" ? "never" : "tablet",
            );
            if (scenario !== "never")
              await choose(
                "Collapse style",
                scenario === "background" ? "dropdown" : scenario,
              );
          }
          if (definition.type === "button" && scenario !== "default")
            await choose("Destination type", scenario);
          if (
            definition.type === "button" &&
            ["external", "email", "telephone"].includes(scenario)
          ) {
            const label = {
              external: "URL",
              email: "Email address",
              telephone: "Telephone",
            }[scenario];
            const field = page.getByLabel(label, { exact: true });
            const accepted = await field.inputValue();
            await field.fill("invalid");
            await field.press("Enter");
            assert.equal(await field.getAttribute("aria-invalid"), "true");
            const errorId = await field.getAttribute("aria-describedby");
            assert.ok(
              await page.locator(`[id=${JSON.stringify(errorId)}]`).isVisible(),
            );
            await field.press("Escape");
            assert.equal(await field.inputValue(), accepted);
            assert.notEqual(await field.getAttribute("aria-invalid"), "true");
          }
          const props = {
            ...element.props,
            ...(definition.type === "logo" ? { display: scenario } : {}),
            ...(definition.type === "menu"
              ? {
                  collapseAt: scenario === "never" ? "never" : "tablet",
                  presentation:
                    scenario === "fullscreen" ? "fullscreen" : "dropdown",
                  itemAppearance:
                    scenario === "background"
                      ? "background"
                      : element.props.itemAppearance,
                }
              : {}),
          };
          await assertDefinitionFields(
            definition,
            "Content",
            props,
            scenario,
            width,
          );
          await inspect("Content", definition.type, scenario, width);
          await page.getByRole("tab", { name: "Style", exact: true }).click();
          if (definition.type === "menu" && scenario === "background")
            await choose("Item appearance", "background");
          await assertDefinitionFields(
            definition,
            "Style",
            props,
            scenario,
            width,
          );
          await inspect("Style", definition.type, scenario, width);
          if (scenario === "default") {
            await page
              .getByRole("tab", { name: "Advanced", exact: true })
              .click();
            await inspect("Advanced", definition.type, scenario, width);
          }
          results.push({
            element: definition.type,
            scenario,
            width,
            status: "pass",
          });
          console.log(`PASS ${definition.type} ${scenario} ${width}`);
        } catch (error) {
          results.push({
            element: definition.type,
            scenario,
            width,
            status: "fail",
            error: error.message,
          });
          console.log(
            `FAIL ${definition.type} ${scenario} ${width}: ${error.message.split("\n")[0]}`,
          );
          await page.keyboard.press("Escape");
        }
      }
    }
    if (
      process.env.PAGEBLDR_PHASE5_FIELD_ELEMENT &&
      process.env.PAGEBLDR_PHASE5_FIELD_ELEMENT !== "page-design"
    )
      continue;
    try {
      await page
        .getByRole("button", { name: "More editor actions", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Page design", exact: true })
        .click();
      for (const section of [
        "Design",
        "Settings",
        "SEO & social",
        "Variables",
      ]) {
        await page.getByRole("tab", { name: section, exact: true }).click();
        if (section === "Variables") {
          for (const kind of [
            "color",
            "typography",
            "spacing",
            "radius",
            "shadow",
            "contentWidth",
          ]) {
            await choose("New variable kind", kind);
            const name = `Field gate ${kind}`;
            await page.getByLabel("Add variable", { exact: true }).fill(name);
            await page
              .getByLabel("Add variable", { exact: true })
              .press("Enter");
            if (
              ["spacing", "radius", "contentWidth", "shadow"].includes(kind)
            ) {
              const field = page.getByLabel(`${name} value`, { exact: true });
              const accepted = await field.inputValue();
              await field.fill(kind === "shadow" ? "invalid" : "");
              await field.press("Enter");
              assert.equal(await field.getAttribute("aria-invalid"), "true");
              const errorId = await field.getAttribute("aria-describedby");
              assert.ok(
                await page
                  .locator(`[id=${JSON.stringify(errorId)}]`)
                  .isVisible(),
              );
              await field.press("Escape");
              assert.equal(await field.inputValue(), accepted);
              if (kind !== "shadow") {
                await choose(`${name} value unit`, "%");
                assert.equal(
                  await page
                    .getByLabel(`${name} value unit`, { exact: true })
                    .getAttribute("data-value"),
                  "%",
                );
                assert.equal(await field.inputValue(), accepted);
                await choose(`${name} value unit`, "px");
              }
              assert.ok(
                await page
                  .getByRole("dialog", { name: "Page design", exact: true })
                  .isVisible(),
              );
            }
          }
          const variableName = page.getByLabel("Spacing Variable name", {
            exact: true,
          });
          const acceptedName = await variableName.inputValue();
          await variableName.fill("");
          await variableName.press("Enter");
          assert.equal(await variableName.getAttribute("aria-invalid"), "true");
          assert.ok(await variableName.getAttribute("aria-describedby"));
          await variableName.press("Escape");
          assert.equal(await variableName.inputValue(), acceptedName);
          const newName = page.getByLabel("Add variable", { exact: true });
          await newName.fill(acceptedName);
          assert.equal(await newName.getAttribute("aria-invalid"), "true");
          assert.ok(await newName.getAttribute("aria-describedby"));
          await newName.fill("");
        }
        await inspect(section, "page-design", "default", width);
      }
      results.push({
        element: "page-design",
        scenario: "all-sections-and-variable-kinds",
        width,
        status: "pass",
      });
    } catch (error) {
      results.push({
        element: "page-design",
        width,
        status: "fail",
        error: error.message,
      });
      console.log(`FAIL Page design ${width}: ${error.message.split("\n")[0]}`);
    }
  }
} finally {
  const artifact = await (
    await page.request.get("http://localhost:5173/packed-artifact.json")
  ).json();
  await writeFile(
    join(output, "field-keyboard-matrix.json"),
    JSON.stringify(
      {
        artifact,
        browser: browser.version(),
        results,
        fields,
        contracts,
        pageErrors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  `${results.filter((result) => result.status === "pass").length}/${results.length} scenarios passed; ${fields.length} field paths`,
);
if (results.some((result) => result.status === "fail") || pageErrors.length)
  process.exitCode = 1;
