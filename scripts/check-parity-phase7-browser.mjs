// Packed public-interface acceptance. Only private Reference Host storage/test
// transport flags are inspected; editor operations use its accessible UI.
/* global localStorage, sessionStorage, document */
import assert from "node:assert/strict";
import console from "node:console";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import process from "node:process";

const [consumer, executablePath, evidence] = process.argv.slice(2);
const require = createRequire(join(resolve(consumer), "package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const output = resolve(
  evidence ?? "release-evidence/parity-phase-7/browser-2026-10-08",
);
await mkdir(output, { recursive: true });
const origin = process.env.PAGEBLDR_PHASE7_ORIGIN ?? "http://localhost:5180";
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
const results = [],
  errors = [],
  accessibility = [];
page.on("pageerror", (error) => errors.push(error.message));
const artifact = await (
  await page.request.get(`${origin}/packed-artifact.json`)
).json();
async function check(name, run) {
  if (
    process.env.PAGEBLDR_PHASE7_FILTER &&
    !new RegExp(process.env.PAGEBLDR_PHASE7_FILTER, "u").test(name)
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
async function fresh(
  route = "#/editor",
  viewport = { width: 1440, height: 900 },
) {
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/${route}`);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("pagebldr:reference:")) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("pagebldr:reference:")) sessionStorage.removeItem(key);
  });
  await page.reload();
  await page
    .frameLocator("iframe")
    .locator("[data-pagebldr-renderer]")
    .waitFor({ state: "attached" });
}
async function state(target = page) {
  return target.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("pagebldr:reference:lifecycle:"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}
async function eventually(read, predicate) {
  const deadline = Date.now() + 10000;
  let value;
  do {
    value = await read();
    if (predicate(value)) return value;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  throw new Error(
    `State did not converge: ${JSON.stringify(value)?.slice(0, 180)}`,
  );
}
const title = () =>
  page.getByRole("textbox", {
    name: "Page title",
    exact: true,
    includeHidden: true,
  });
async function saved() {
  await eventually(
    async () => {
      const save = page.getByRole("button", {
        name: "Save",
        exact: true,
        includeHidden: true,
      });
      return {
        texts: await page.getByRole("status").allTextContents(),
        idle: (await save.count()) === 1 && (await save.isEnabled()),
      };
    },
    ({ texts, idle }) => texts.includes("Saved") && idle,
  );
}
async function history(tab = "Revisions") {
  await page
    .getByRole("button", { name: "More editor actions", exact: true })
    .click();
  const menu = await page.getByRole("menu").boundingBox();
  assert(
    menu && menu.x >= 0 && menu.y >= 0,
    "More menu must be positioned inside the viewport.",
  );
  await page.getByRole("menuitem", { name: "History", exact: true }).click();
  await page.getByRole("dialog", { name: "History", exact: true }).waitFor();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}
async function closeHistory() {
  await page
    .getByRole("dialog", { name: "History", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
}
async function axe(name) {
  const full = await new AxeBuilder({ page }).analyze();
  const scoped = await new AxeBuilder({ page })
    .exclude("iframe")
    .exclude("[data-pagebldr-renderer]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  accessibility.push({
    name,
    full: full.violations,
    editor: scoped.violations,
  });
  // Authored palette findings remain in full evidence; never exclude package UI.
  assert.equal(
    scoped.violations.length,
    0,
    `${name}: ${scoped.violations.map((issue) => issue.id).join(", ")}`,
  );
}

try {
  await check(
    "serialized autosave keeps later typing and creates no Revision",
    async () => {
      await fresh();
      await page.evaluate(() =>
        sessionStorage.setItem("pagebldr:reference:latency", "1200"),
      );
      await title().fill("Submitted autosave");
      await eventually(
        () => page.getByRole("status").allTextContents(),
        (texts) => texts.includes("Saving…"),
      );
      await title().fill("Later typing");
      await eventually(
        state,
        (value) => value?.document.document.title === "Submitted autosave",
      );
      const final = await eventually(
        state,
        (value) => value?.document.document.title === "Later typing",
      );
      assert.equal(final.document.version, 3);
      assert.equal(final.revisions.length, 0);
      await saved();
    },
  );
  await check(
    "Save draft and local Actions jump independently of durable Revisions",
    async () => {
      await fresh();
      await title().fill("Saved design");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await saved();
      let current = await state();
      assert.equal(current.revisions.length, 1);
      assert.equal(current.revisions[0].kind, "save");
      await history("Actions");
      await page
        .getByRole("button", { name: "Opened editor", exact: true })
        .click();
      assert.notEqual(await title().inputValue(), "Saved design");
      await page.screenshot({
        path: join(output, "history-actions-desktop.png"),
      });
      await axe("local Actions");
      await closeHistory();
      await saved();
      current = await state();
      assert.equal(current.revisions.length, 1);
    },
  );
  await check(
    "Publish, Revision preview, Restore and Unpublish preserve the intended live/draft split",
    async () => {
      await fresh();
      await title().fill("First design");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await saved();
      const first = (await state()).revisions[0];
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await saved();
      const liveId = (await state()).publication.revisionId;
      assert.equal(
        await page.getByRole("button", { name: "Update", exact: true }).count(),
        1,
      );
      await title().fill("Second design");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await saved();
      await history();
      const card = page.getByRole("group", {
        name: `save Revision ${first.version}`,
        exact: true,
      });
      await card.getByRole("button", { name: "Preview", exact: true }).click();
      const preview = page.getByRole("dialog", {
        name: "Revision preview",
        exact: true,
      });
      await preview.waitFor();
      assert.match(await preview.textContent(), /First design/u);
      assert.equal(await title().inputValue(), "Second design");
      await axe("Revision preview");
      await preview.getByRole("button", { name: "Close", exact: true }).click();
      await card.getByRole("button", { name: "Restore", exact: true }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Restore draft", exact: true })
        .click();
      await saved();
      const restored = await state();
      assert.equal(restored.document.document.title, "First design");
      assert.equal(restored.revisions[0].kind, "restore");
      assert.equal(restored.publication.revisionId, liveId);
      await page.screenshot({
        path: join(output, "history-revisions-desktop.png"),
      });
      await axe("durable Revisions");
      await closeHistory();
      await page
        .getByRole("button", { name: "More editor actions", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Unpublish", exact: true })
        .click();
      await axe("Unpublish confirmation");
      await page
        .getByRole("button", { name: "Unpublish page", exact: true })
        .click();
      await saved();
      const unpublished = await state();
      assert.equal(unpublished.publication, null);
      assert.equal(unpublished.document.document.title, "First design");
    },
  );
  for (const kind of ["save", "publish"])
    await check(
      `lost ${kind} response replays one Revision and Audit ID`,
      async () => {
        await fresh();
        await title().fill(`Before ${kind}`);
        await saved();
        await page.evaluate(
          (operation) =>
            sessionStorage.setItem(
              "pagebldr:reference:lose-response",
              operation,
            ),
          kind,
        );
        await page
          .getByRole("button", {
            name: kind === "save" ? "Save" : "Publish",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .waitFor();
        const committed = await state();
        const ids = committed.audits.map((row) => row.event.id);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await saved();
        const replayed = await state();
        assert.equal(replayed.document.version, committed.document.version);
        assert.equal(replayed.revisions.length, committed.revisions.length);
        assert.deepEqual(
          replayed.audits.map((row) => row.event.id),
          ids,
        );
      },
    );
  await check(
    "two sessions conflict without losing local Actions and deliberately retry exact local work",
    async () => {
      await fresh();
      const second = await context.newPage();
      await second.goto(`${origin}/#/editor`);
      await second.getByRole("textbox", { name: "Page title" }).waitFor();
      await title().fill("Session A");
      await saved();
      await second
        .getByRole("textbox", { name: "Page title" })
        .fill("Session B local");
      await second
        .getByRole("button", { name: "Resolve conflict", exact: true })
        .waitFor();
      assert.equal((await state()).document.document.title, "Session A");
      assert.equal(
        await second.getByRole("textbox", { name: "Page title" }).inputValue(),
        "Session B local",
      );
      assert.equal(
        await second
          .getByRole("button", { name: "Undo", exact: true })
          .isEnabled(),
        true,
      );
      await second
        .getByRole("button", { name: "Resolve conflict", exact: true })
        .click();
      await second.getByText(/Server version 2: Session A/u).waitFor();
      await second.screenshot({ path: join(output, "conflict-desktop.png") });
      await second
        .getByRole("button", {
          name: "Keep local draft and retry",
          exact: true,
        })
        .click();
      await eventually(
        state,
        (value) =>
          value?.document.document.title === "Session B local" &&
          value.document.version === 3,
      );
      assert.equal(
        await second
          .getByRole("button", { name: "Undo", exact: true })
          .isEnabled(),
        true,
      );
      await second.close();
    },
  );
  await check(
    "publication blocks unconfirmed managed image usage until the editor confirms it",
    async () => {
      await fresh();
      await title().fill("Managed image validation");
      await saved();
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.startsWith("pagebldr:reference:lifecycle:"),
        );
        const state = JSON.parse(localStorage.getItem(key));
        const image = Object.values(state.document.document.elements).find(
          (element) => element.type === "image",
        );
        image.props = {
          ...image.props,
          source: {
            type: "resource",
            reference: { kind: "asset", value: "image-1" },
          },
          alt: "Managed illustration",
          altConfirmed: false,
          decorative: false,
        };
        localStorage.setItem(key, JSON.stringify(state));
      });
      await page.reload();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      const review = page.getByRole("dialog", {
        name: "Review publication",
        exact: true,
      });
      await review.getByText(/Confirm alternative text/u).waitFor();
      await axe("blocking publication validation");
      assert.equal((await state()).publication, null);
      await review
        .getByRole("button", { name: "Return to editor", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Expand Hero content", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Hero garden image", exact: true })
        .click();
      await page
        .getByRole("switch", {
          name: "Alternative text confirmed",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await saved();
      assert.notEqual((await state()).publication, null);
    },
  );
  await check(
    "unpublished Host destination requires explicit Publish anyway confirmation",
    async () => {
      await fresh();
      await title().fill("Warning confirmation");
      await saved();
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.startsWith("pagebldr:reference:lifecycle:"),
        );
        const state = JSON.parse(localStorage.getItem(key));
        const button = Object.values(state.document.document.elements).find(
          (element) => element.type === "button",
        );
        button.props.destination = {
          type: "application",
          reference: { kind: "application-link", value: "pricing" },
        };
        localStorage.setItem(key, JSON.stringify(state));
      });
      await page.reload();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      const review = page.getByRole("dialog", {
        name: "Review publication",
        exact: true,
      });
      await review.getByText(/not published/u).waitFor();
      await axe("publication warning confirmation");
      assert.equal((await state()).publication, null);
      await review
        .getByRole("button", { name: "Publish anyway", exact: true })
        .click();
      await saved();
      assert.notEqual((await state()).publication, null);
    },
  );
  await check(
    "matching local recovery survives reload, recovers and clears only after save",
    async () => {
      await fresh();
      await page.evaluate(() =>
        sessionStorage.setItem("pagebldr:reference:offline", "true"),
      );
      await title().fill("Recovered after reload");
      await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
      await page.reload();
      await page
        .getByRole("alertdialog", { name: "Recover unsaved work?" })
        .waitFor();
      await axe("recovery prompt");
      await page.evaluate(() =>
        sessionStorage.removeItem("pagebldr:reference:offline"),
      );
      await page
        .getByRole("button", { name: "Recover local draft", exact: true })
        .click();
      await saved();
      assert.equal(
        (await state()).document.document.title,
        "Recovered after reload",
      );
      assert.equal(
        await page.evaluate(
          () =>
            Object.keys(localStorage).filter((key) =>
              key.startsWith("pagebldr:reference:recovery:"),
            ).length,
        ),
        0,
      );
    },
  );
  await check(
    "mismatched recovery resumes in Conflict and downloads the exact local JSON",
    async () => {
      await fresh();
      await title().fill("Server head");
      await saved();
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.startsWith("pagebldr:reference:lifecycle:"),
        );
        const state = JSON.parse(localStorage.getItem(key));
        const document = {
          ...state.document.document,
          title: "Recovered conflicting local",
        };
        localStorage.setItem(
          `pagebldr:reference:recovery:v1:${document.id}`,
          JSON.stringify({
            schemaVersion: 1,
            document,
            version: 1,
            savedAt: new Date().toISOString(),
          }),
        );
      });
      await page.reload();
      await page
        .getByRole("button", { name: "Recover local draft", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Resolve conflict", exact: true })
        .waitFor();
      assert.equal((await state()).document.document.title, "Server head");
      const downloading = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download local JSON", exact: true })
        .click();
      const download = await downloading;
      const local = JSON.parse(await readFile(await download.path(), "utf8"));
      assert.equal(local.title, "Recovered conflicting local");
      await axe("conflict controls");
    },
  );
  await check(
    "invalid recovery is removed and valid recovery can be discarded",
    async () => {
      await fresh();
      await title().fill("Authoritative draft");
      await saved();
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.startsWith("pagebldr:reference:lifecycle:"),
        );
        const state = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(
          `pagebldr:reference:recovery:v1:${state.document.document.id}`,
          "invalid JSON",
        );
      });
      await page.reload();
      await title().waitFor();
      assert.equal(await page.getByRole("alertdialog").count(), 0);
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) =>
          item.startsWith("pagebldr:reference:lifecycle:"),
        );
        const state = JSON.parse(localStorage.getItem(key));
        const document = { ...state.document.document, title: "Discard this" };
        localStorage.setItem(
          `pagebldr:reference:recovery:v1:${document.id}`,
          JSON.stringify({
            schemaVersion: 1,
            document,
            version: state.document.version,
            savedAt: new Date().toISOString(),
          }),
        );
      });
      await page.reload();
      await page
        .getByRole("button", { name: "Discard local recovery", exact: true })
        .click();
      assert.equal(await title().inputValue(), "Authoritative draft");
    },
  );
  await check(
    "retention keeps newest 50 plus protected Live; Update releases the old protected snapshot",
    async () => {
      await fresh("#/editor/lifecycle");
      await page.evaluate(() =>
        sessionStorage.setItem("pagebldr:reference:latency", "0"),
      );
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await saved();
      const liveId = (await state()).publication.revisionId;
      for (let index = 0; index < 51; index++) {
        const version = (await state()).document.version;
        await title().fill(`Retained ${index}`);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await eventually(
          state,
          (value) => value?.document.version === version + 1,
        );
        await saved();
      }
      const retained = await state();
      assert.equal(retained.revisions.length, 51);
      assert(retained.revisions.some((revision) => revision.id === liveId));
      await page.getByRole("button", { name: "Update", exact: true }).click();
      await saved();
      const updated = await state();
      assert.equal(updated.revisions.length, 50);
      assert(!updated.revisions.some((revision) => revision.id === liveId));
    },
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["phone", 390, 844],
  ])
    await check(
      `History and recovery keyboard journey at ${name}`,
      async () => {
        await fresh("#/editor", { width, height });
        async function tabTo(locator) {
          for (let step = 0; step < 100; step++) {
            if (
              await locator.evaluate(
                (element) => element === document.activeElement,
              )
            )
              return;
            await page.keyboard.press("Tab");
          }
          throw new Error("Keyboard could not reach the requested control.");
        }
        await tabTo(title());
        await page.keyboard.press("Control+A");
        await page.keyboard.type(`Keyboard ${name}`);
        await page.keyboard.press("Control+S");
        await saved();
        const more = page.getByRole("button", {
          name: "More editor actions",
          exact: true,
        });
        await tabTo(more);
        await page.keyboard.press("Enter");
        await page.getByRole("menu").waitFor();
        await page.keyboard.press("Home");
        for (let step = 0; step < 12; step++) {
          const focused = await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          );
          if (focused === "History") break;
          await page.keyboard.press("ArrowDown");
          await eventually(
            () =>
              page.evaluate(() => document.activeElement?.textContent?.trim()),
            (next) => next !== focused,
          );
        }
        await page.keyboard.press("Enter");
        await page
          .getByRole("dialog", { name: "History", exact: true })
          .waitFor();
        await tabTo(page.getByRole("tab", { name: "Actions", exact: true }));
        await page.keyboard.press("ArrowRight");
        await page.getByText(/Saved · Revision/u).waitFor();
        await axe(`History ${name}`);
        await page.screenshot({
          path: join(output, `history-revisions-${name}.png`),
        });
        await page.keyboard.press("Escape");
        await page
          .getByRole("dialog", { name: "History", exact: true })
          .waitFor({ state: "detached" });
        await eventually(
          () => more.evaluate((element) => element === document.activeElement),
          (focused) => focused,
        );
        await page.evaluate(() =>
          sessionStorage.setItem("pagebldr:reference:offline", "true"),
        );
        await tabTo(title());
        await page.keyboard.press("Control+A");
        await page.keyboard.type(`Keyboard recovery ${name}`);
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .waitFor();
        await page.reload();
        await page
          .getByRole("alertdialog", { name: "Recover unsaved work?" })
          .waitFor();
        await axe(`Recovery ${name}`);
        await page.screenshot({ path: join(output, `recovery-${name}.png`) });
        await page.evaluate(() =>
          sessionStorage.removeItem("pagebldr:reference:offline"),
        );
        await tabTo(
          page.getByRole("button", {
            name: "Recover local draft",
            exact: true,
          }),
        );
        await page.keyboard.press("Enter");
        await saved();
        assert.equal(
          (await state()).document.document.title,
          `Keyboard recovery ${name}`,
        );
      },
    );
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify({ artifact, results, accessibility, errors }, null, 2),
  );
  await browser.close();
}
if (results.some((result) => result.status !== "pass")) process.exitCode = 1;
