import { z } from "zod";

import type { PageDocument } from "./document-types.js";
import type { ResourceReference } from "./types.js";
import { PagebldrError } from "./types.js";

export type Destination =
  | {
      readonly type: "external";
      readonly url: string;
      readonly newTab: boolean;
    }
  | { readonly type: "anchor"; readonly elementId: string }
  | {
      readonly type: "email";
      readonly address: string;
      readonly subject?: string | undefined;
    }
  | { readonly type: "telephone"; readonly number: string }
  | {
      readonly type: "application";
      readonly reference: ResourceReference;
      readonly newTab?: boolean | undefined;
    };

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);
const safeHttpUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Only HTTP and HTTPS URLs are supported.");

const destinationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("external"),
      url: safeHttpUrl,
      newTab: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("anchor"), elementId: id }).strict(),
  z
    .object({
      type: z.literal("email"),
      address: z.string().email().max(320),
      subject: z.string().max(300).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("telephone"),
      number: z
        .string()
        .min(3)
        .max(40)
        .regex(/^\+?[0-9 ().-]+$/u),
    })
    .strict(),
  z
    .object({
      type: z.literal("application"),
      reference: z
        .object({ kind: z.string().min(1), value: z.unknown() })
        .strict(),
      newTab: z.boolean().optional(),
    })
    .strict(),
]);

export function parseDestination(value: unknown): Destination {
  const result = destinationSchema.safeParse(value);
  if (!result.success) {
    throw new PagebldrError(
      "INVALID_ELEMENT",
      "A link destination is invalid.",
      {
        details: { issues: result.error.issues },
      },
    );
  }
  return result.data as Destination;
}

export interface ResolvedDestination {
  readonly href: string | null;
  readonly newTab: boolean;
}

export function resolveDestination(
  document: PageDocument,
  value: unknown,
  resolveApplication?: (reference: ResourceReference) => string | null,
): ResolvedDestination {
  let destination: Destination;
  try {
    destination = parseDestination(value);
  } catch {
    return { href: null, newTab: false };
  }
  switch (destination.type) {
    case "external":
      return { href: destination.url, newTab: destination.newTab };
    case "anchor": {
      const anchor = document.elements[destination.elementId]?.props.anchorId;
      return {
        href: `#${typeof anchor === "string" ? anchor : `pagebldr-${destination.elementId}`}`,
        newTab: false,
      };
    }
    case "email":
      return {
        href: `mailto:${destination.address}${destination.subject ? `?subject=${encodeURIComponent(destination.subject)}` : ""}`,
        newTab: false,
      };
    case "telephone":
      return {
        href: `tel:${destination.number.replace(/[ ().-]/gu, "")}`,
        newTab: false,
      };
    case "application":
      return {
        href: resolveApplication?.(destination.reference) ?? null,
        newTab: destination.newTab ?? false,
      };
  }
}
