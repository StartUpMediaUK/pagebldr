import { describe, expect, it } from "vitest";

import { createDocument } from "./document.js";
import { resolveDestination } from "./destinations.js";

describe("Destination resolution", () => {
  const document = {
    ...createDocument({ id: "destinations" }),
    elements: {
      root: {
        ...createDocument({ id: "destinations" }).elements.root!,
        props: { anchorId: "start-here" },
      },
    },
  };

  it("resolves web, anchor, email and telephone destinations", () => {
    expect(
      resolveDestination(document, {
        type: "external",
        url: "https://example.com",
        newTab: true,
      }),
    ).toEqual({ href: "https://example.com", newTab: true });
    expect(
      resolveDestination(document, { type: "anchor", elementId: "root" }),
    ).toEqual({ href: "#start-here", newTab: false });
    expect(
      resolveDestination(document, {
        type: "email",
        address: "hello@example.com",
        subject: "A useful subject",
      }),
    ).toEqual({
      href: "mailto:hello@example.com?subject=A%20useful%20subject",
      newTab: false,
    });
    expect(
      resolveDestination(document, {
        type: "telephone",
        number: "+44 (0) 20-1234",
      }),
    ).toEqual({ href: "tel:+440201234", newTab: false });
  });

  it("delegates application Resources and safely disables unresolved values", () => {
    const reference = { kind: "page", value: "pricing" };
    expect(
      resolveDestination(
        document,
        { type: "application", reference },
        (value) =>
          value.kind === "page" && value.value === "pricing"
            ? "/pricing"
            : null,
      ),
    ).toEqual({ href: "/pricing", newTab: false });
    expect(resolveDestination(document, { type: "unsafe" })).toEqual({
      href: null,
      newTab: false,
    });
  });
});
