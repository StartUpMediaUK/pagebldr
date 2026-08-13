import { z } from "zod";

import {
  BREAKPOINTS,
  DOCUMENT_FORMAT,
  MAX_DOCUMENT_ELEMENTS,
  MAX_ELEMENT_CHILDREN,
  MAX_ELEMENT_CLASSES,
  STYLE_STATES,
  VARIABLE_KINDS,
} from "./document-constants.js";

export const documentIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);

const styleValueSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z
    .object({ type: z.literal("variable"), variableId: documentIdSchema })
    .strict(),
]);
const declarationsSchema = z.record(
  z.string().min(1).max(80),
  styleValueSchema,
);
const stateStylesSchema = z
  .object(
    Object.fromEntries(
      STYLE_STATES.map((state) => [state, declarationsSchema.optional()]),
    ),
  )
  .strict();
const responsiveStylesSchema = z
  .object(
    Object.fromEntries(
      BREAKPOINTS.map((breakpoint) => [
        breakpoint,
        stateStylesSchema.optional(),
      ]),
    ),
  )
  .strict();

export const pageElementSchema = z
  .object({
    id: documentIdSchema,
    type: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9-]*$/u),
    elementVersion: z.number().int().min(1),
    name: z.string().min(1).max(120),
    props: z.record(z.string(), z.unknown()),
    children: z.array(documentIdSchema).max(MAX_ELEMENT_CHILDREN),
    classIds: z.array(documentIdSchema).max(MAX_ELEMENT_CLASSES),
    styles: responsiveStylesSchema,
    locked: z.boolean(),
    hidden: z.boolean(),
  })
  .strict();

const styleClassSchema = z
  .object({
    id: documentIdSchema,
    name: z.string().min(1).max(120),
    styles: responsiveStylesSchema,
  })
  .strict();
const styleVariableSchema = z
  .object({
    id: documentIdSchema,
    name: z.string().min(1).max(120),
    kind: z.enum(VARIABLE_KINDS),
    value: z.union([z.string().max(2_000), z.number().finite()]),
  })
  .strict();

export const pageDocumentSchema = z
  .object({
    format: z.literal(DOCUMENT_FORMAT),
    schemaVersion: z.number().int().min(1),
    id: documentIdSchema,
    title: z.string().min(1).max(160),
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    rootId: documentIdSchema,
    elements: z
      .record(documentIdSchema, pageElementSchema)
      .refine(
        (elements) => Object.keys(elements).length <= MAX_DOCUMENT_ELEMENTS,
        `A Document may contain at most ${MAX_DOCUMENT_ELEMENTS} Elements.`,
      ),
    classes: z.record(documentIdSchema, styleClassSchema),
    classOrder: z.array(documentIdSchema),
    variables: z.record(documentIdSchema, styleVariableSchema),
    variableOrder: z.array(documentIdSchema),
    settings: z
      .object({
        contentWidth: z.number().int().min(320).max(2_400),
        breakpoints: z
          .object({
            tabletMax: z.number().int().min(768).max(1_200),
            mobileMax: z.number().int().min(320).max(767),
          })
          .strict()
          .refine(({ mobileMax, tabletMax }) => mobileMax < tabletMax),
        metadata: z
          .object({
            title: z.string().max(160),
            description: z.string().max(500),
            noIndex: z.boolean(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
