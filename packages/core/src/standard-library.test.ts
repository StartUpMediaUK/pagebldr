import { describe, it, expect } from "vitest";
import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
} from "./index.js";
import { standardBlocks } from "./standard-library.js";
import { readFileSync } from "node:fs";
const fixtureKeys = [
  "growth-bottleneck-audit",
  "independent-work-study",
  "business-health-index",
  "business-pulse",
  "solution-fit-finder",
  "project-fit-enquiry",
];

const builder = createPagebldr({
  namespace: "catalogue-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
describe("neutral source catalogue", () => {
  it("has 23 package Blocks and six separate Host testing fixtures", () => {
    expect(standardBlocks).toHaveLength(23);
    expect(fixtureKeys).toHaveLength(6);
    expect(
      new Set([...standardBlocks.map(({ key }) => key), ...fixtureKeys]).size,
    ).toBe(29);
  });
  for (const definition of standardBlocks)
    it(`inserts ${definition.key} twice into an ordinary Document`, () => {
      let document = builder.documents.create({ id: "page" });
      const source = definition.create();
      if (!("format" in source))
        throw new Error("Expected characterized subtree");
      for (let index = 0; index < 2; index++) {
        const clipboard = builder.editor.library.prepareBlock(source, document);
        document = builder.editor.dispatch(document, {
          type: "insert",
          parentId: document.rootId,
          index,
          clipboard,
        }).document;
      }
      expect(builder.documents.validate(document).valid).toBe(true);
      expect(document.elements[document.rootId]?.children).toHaveLength(2);
      expect(JSON.stringify(source)).not.toMatch(/quizr|quizId|quizr-page/iu);
    });
  for (const key of fixtureKeys)
    it(`applies Host testing fixture ${key} without changing page identity`, () => {
      const source = builder.documents.parse(
        JSON.parse(
          readFileSync(
            new URL(
              `../../../fixtures/library/${key}.document.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ) as unknown,
      );
      const validation = builder.documents.validate(source);
      if (!validation.valid) throw validation.error;
      const template = builder.editor.library.cloneTemplate(source);
      const destination = builder.documents.create({
        id: "page",
        title: "Keep this title",
      });
      const applied = builder.editor.dispatch(destination, {
        type: "apply-template",
        template,
      }).document;
      expect(builder.documents.validate(applied).valid).toBe(true);
      expect(applied.title).toBe(destination.title);
      expect(applied.settings.seo).toEqual(destination.settings.seo);
      expect(JSON.stringify(source)).not.toMatch(/quizr|quizId|quizr-page/iu);
    });
});
