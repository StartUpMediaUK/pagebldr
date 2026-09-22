import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const directory = resolve("fixtures/parity");
const expectedElements = new Set([
  "accordion",
  "button",
  "container",
  "copyright",
  "countdown",
  "divider",
  "gallery-carousel",
  "heading",
  "icon",
  "icon-list",
  "image",
  "list",
  "logo",
  "logo-cloud",
  "menu",
  "progress",
  "rich-text",
  "social-links",
  "spacer",
  "star-rating",
  "tabs",
  "testimonial",
  "video",
  "counter",
]);

const files = readdirSync(directory)
  .filter((file) => file.endsWith(".document.json"))
  .sort();

if (files.length !== 3)
  throw new Error(`Expected 3 parity Documents; found ${files.length}.`);

for (const file of files) {
  const text = readFileSync(resolve(directory, file), "utf8");
  if (/quizr|quizr-page|quiz/iu.test(text))
    throw new Error(`${file} contains product-specific source vocabulary.`);
  const document = JSON.parse(text);
  if (document.format !== "pagebldr" || document.schemaVersion !== 2)
    throw new Error(`${file} does not use target pagebldr schema version 2.`);
  assertDocumentShape(file, document);
}

const allElements = JSON.parse(
  readFileSync(resolve(directory, "all-elements.document.json"), "utf8"),
);
const actualElements = new Set(
  Object.values(allElements.elements).map((element) => element.type),
);
if (
  actualElements.size !== expectedElements.size ||
  [...expectedElements].some((type) => !actualElements.has(type))
)
  throw new Error(
    `All-Elements fixture does not contain the exact ${expectedElements.size}-type inventory.`,
  );

const project = JSON.parse(
  readFileSync(resolve(directory, "project-enquiry.document.json"), "utf8"),
);
if (Object.keys(project.elements).length !== 132)
  throw new Error("Project Enquiry fixture must contain 132 Elements.");

process.stdout.write(
  `Validated ${files.length} neutral parity Documents and ${expectedElements.size} standard Element types.\n`,
);

function assertDocumentShape(file, document) {
  if (!document.elements?.[document.rootId])
    throw new Error(`${file} is missing its root Element.`);
  if (document.elements[document.rootId].type !== "container")
    throw new Error(`${file} root must be a container.`);

  assertOrderedMap(file, "Class", document.classes, document.classOrder);
  assertOrderedMap(
    file,
    "Variable",
    document.variables,
    document.variableOrder,
  );

  const parents = new Map();
  const visited = new Set();
  const visit = (id, path) => {
    if (path.has(id)) throw new Error(`${file} contains a cycle at ${id}.`);
    const element = document.elements[id];
    if (!element) throw new Error(`${file} references missing Element ${id}.`);
    if (element.id !== id)
      throw new Error(`${file} Element map key does not match ${id}.`);
    visited.add(id);
    const nextPath = new Set(path).add(id);
    for (const childId of element.children) {
      if (parents.has(childId))
        throw new Error(`${file} gives Element ${childId} multiple parents.`);
      parents.set(childId, id);
      visit(childId, nextPath);
    }
  };
  visit(document.rootId, new Set());
  if (visited.size !== Object.keys(document.elements).length)
    throw new Error(`${file} contains orphan Elements.`);
  if (parents.has(document.rootId))
    throw new Error(`${file} gives the root a parent.`);
}

function assertOrderedMap(file, label, records, order) {
  const keys = Object.keys(records ?? {}).sort();
  const ordered = [...(order ?? [])].sort();
  if (JSON.stringify(keys) !== JSON.stringify(ordered))
    throw new Error(`${file} ${label} order does not match its map.`);
}
