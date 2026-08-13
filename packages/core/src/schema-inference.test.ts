import { z } from "zod";
import { expectTypeOf, test } from "vitest";

import { defineElement } from "./index.js";

test("a Standard Schema compatible Zod schema infers element props", () => {
  const heading = defineElement({
    type: "heading",
    version: 1,
    label: "Heading",
    props: z.object({ text: z.string(), level: z.number().int() }),
    defaults: () => ({ text: "Heading", level: 2 }),
    controls: [
      { key: "text", label: "Text" },
      { key: "level", label: "Level" },
    ],
    migrate: () => ({ text: "Migrated", level: 2 }),
    references: (props) => {
      expectTypeOf(props).toEqualTypeOf<{ text: string; level: number }>();
      return [];
    },
  });

  expectTypeOf(heading.type).toEqualTypeOf<"heading">();
  expectTypeOf(heading.defaults()).toEqualTypeOf<{
    text: string;
    level: number;
  }>();
});
