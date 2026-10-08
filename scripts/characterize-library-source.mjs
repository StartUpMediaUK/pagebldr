// Read-only, pinned-source characterization. Prints package-native catalogue
// values for review; it neither edits the source repository nor writes files.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import process from "node:process";
const { structuredClone } = globalThis;
import ts from "typescript";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "../packages/pagebldr/dist/index.js";

const repository = process.argv[2];
if (!repository)
  throw new Error("Supply the read-only source repository path.");
const commit = "7dec26465c454b25545664e84d8e1e91b97ae9d1";
const builder = createPagebldr({
  namespace: "catalogue-characterization",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const cache = new Map();
const modules = [
  "core-library",
  "growth-bottleneck-audit",
  "independent-work-study",
  "business-health-index",
  "business-pulse",
  "solution-fit-finder",
  "project-fit-enquiry",
];
class Registry {
  entries = [];
  register(value) {
    this.entries.push(value);
  }
}
const shim = {
  createCorePageBuilderV2ElementRegistry: () => builder.elements,
  createPageBuilderV2Element: ({ type, id, name }) => {
    const definition = builder.elements.get(type);
    if (!definition) throw new Error(`Unknown source Element ${type}`);
    return {
      id,
      type,
      elementVersion: definition.version,
      name: name ?? definition.label,
      props: definition.defaults(),
      children: [],
      classIds: [],
      styles: {},
      locked: false,
      hidden: false,
    };
  },
  createEmptyPageBuilderV2Document: (input) => builder.documents.create(input),
  PAGE_BUILDER_V2_GEIST_FONT_FAMILY: "Geist, sans-serif",
  PageBuilderV2BlockRegistry: Registry,
  PageBuilderV2TemplateRegistry: Registry,
  validatePageBuilderV2Document: () => {},
};
function load(name) {
  if (cache.has(name)) return cache.get(name);
  if (!modules.includes(name))
    throw new Error(`Uninventoried source module ${name}`);
  const source = execFileSync(
    "git",
    [
      "-C",
      repository,
      "show",
      `${commit}:src/lib/page-builder-v2/templates/${name}.ts`,
    ],
    { encoding: "utf8", maxBuffer: 4_000_000 },
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  runInNewContext(
    code,
    {
      exports,
      structuredClone,
      Date,
      require: (specifier) =>
        specifier.startsWith("./") ? load(specifier.slice(2)) : shim,
    },
    { timeout: 5000 },
  );
  cache.set(name, exports);
  return exports;
}
function normalize(value) {
  if (typeof value === "string")
    return value
      .replace(/https:\/\/quizr\.(?:uk|com)/gu, "https://example.com/start")
      .replace(/Quizr/gu, "Your Brand");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    if (value.type === "builtin")
      return {
        type: "resource",
        reference: {
          kind: "template-media",
          value: value.path.split("/").pop(),
        },
      };
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}
let sequence = 0;
const idFactory = (prefix) => `catalogue-${prefix}-${++sequence}`;
const registries =
  load("core-library").createCorePageBuilderV2LibraryRegistries();
const output = { blocks: [], templates: [] };
for (const kind of ["blocks", "templates"]) {
  for (const definition of registries[kind].entries) {
    const data = normalize(definition.create(idFactory));
    for (const element of Object.values(data.elements)) {
      const definition = builder.elements.get(element.type);
      element.props = { ...definition.defaults(), ...element.props };
      element.elementVersion = definition.version;
    }
    if (kind === "blocks") {
      data.format = "pagebldr-clipboard";
      data.schemaVersion = 1;
    } else {
      data.format = "pagebldr";
      data.schemaVersion = 2;
    }
    output[kind].push({
      key: definition.id,
      label: definition.name,
      category: definition.category,
      description: definition.description,
      tags: definition.tags,
      thumbnail: definition.thumbnail,
      data,
    });
  }
}
const requested = process.argv[3];
if (requested === "--check") {
  const read = (path) =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  // Compare the JSON artifact contract, not the source VM's realm prototypes.
  for (const [kind, items] of Object.entries(
    JSON.parse(JSON.stringify(output)),
  )) {
    const metadata = read(
      kind === "blocks"
        ? "../packages/core/src/catalogue/index.json"
        : "../fixtures/library/index.json",
    );
    assert.deepEqual(
      kind === "blocks" ? metadata.blocks : metadata,
      items.map((item) =>
        Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== "data"),
        ),
      ),
    );
    for (const entry of items)
      assert.deepEqual(
        read(
          kind === "blocks"
            ? `../packages/core/src/catalogue/${entry.key}.json`
            : `../fixtures/library/${entry.key}.document.json`,
        ),
        entry.data,
        entry.key,
      );
  }
  process.stdout.write(
    "Pinned characterization matches all 23 Blocks and six private Template fixtures.\n",
  );
} else
  process.stdout.write(
    JSON.stringify(
      requested === "index"
        ? Object.fromEntries(
            Object.entries(output).map(([kind, items]) => [
              kind,
              items.map((item) =>
                Object.fromEntries(
                  Object.entries(item).filter(([key]) => key !== "data"),
                ),
              ),
            ]),
          )
        : requested
          ? [...output.blocks, ...output.templates].find(
              (item) => item.key === requested,
            )
          : output,
    ),
  );
