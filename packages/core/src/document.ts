import {
  DOCUMENT_FORMAT,
  DOCUMENT_SCHEMA_VERSION,
  MAX_DOCUMENT_DEPTH,
} from "./document-constants.js";
import { pageDocumentSchema } from "./document-schema.js";
import type {
  DocumentIndex,
  PageDocument,
  PageElement,
} from "./document-types.js";
import { PagebldrError } from "./types.js";

export interface CreateDocumentInput {
  readonly id: string;
  readonly title?: string;
  readonly slug?: string;
  readonly rootId?: string;
  readonly rootType?: string;
  readonly rootProps?: Readonly<Record<string, unknown>>;
}

export function createDocument(input: CreateDocumentInput): PageDocument {
  const title = input.title ?? "Untitled page";
  const rootId = input.rootId ?? "root";
  const document: PageDocument = {
    format: DOCUMENT_FORMAT,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: input.id,
    title,
    slug: input.slug ?? "untitled-page",
    rootId,
    elements: {
      [rootId]: {
        id: rootId,
        type: input.rootType ?? "container",
        elementVersion: 1,
        name: "Page",
        props: input.rootProps ?? {},
        children: [],
        classIds: [],
        styles: {},
        locked: false,
        hidden: false,
      },
    },
    classes: {},
    classOrder: [],
    variables: {},
    variableOrder: [],
    settings: {
      contentWidth: 1_200,
      showDefaultHeader: true,
      breakpoints: { tabletMax: 1_024, mobileMax: 767 },
      seo: {
        title,
        description: "",
        socialTitle: "",
        socialDescription: "",
        socialImage: null,
        noIndex: false,
      },
    },
  };
  return parseDocument(document);
}

export function parseDocument(input: unknown): PageDocument {
  const result = pageDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      "The value does not match the pagebldr Document schema.",
      { details: { issues: result.error.issues } },
    );
  }
  return result.data;
}

export function cloneDocument(document: PageDocument): PageDocument {
  return structuredClone(document);
}

export function serializeDocument(document: PageDocument): string {
  const normalized = parseDocument(document);
  return JSON.stringify(sortObject(normalized));
}

export function deserializeDocument(serialized: string): PageDocument {
  try {
    return parseDocument(JSON.parse(serialized) as unknown);
  } catch (error) {
    if (error instanceof PagebldrError) throw error;
    throw new PagebldrError("INVALID_DOCUMENT", "Document JSON is invalid.", {
      cause: error,
    });
  }
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObject(child)]),
  );
}

function assertRecordKeysMatchIds(
  label: string,
  records: Readonly<Record<string, { readonly id: string }>>,
): void {
  for (const [key, value] of Object.entries(records)) {
    if (key !== value.id) {
      throw new PagebldrError(
        "INVALID_DOCUMENT",
        `${label} record key ${key} does not match its ID ${value.id}.`,
      );
    }
  }
}

function assertOrderMatchesRecords(
  label: string,
  order: readonly string[],
  records: Readonly<Record<string, unknown>>,
): void {
  const unique = new Set(order);
  const ids = Object.keys(records);
  if (
    unique.size !== order.length ||
    order.length !== ids.length ||
    ids.some((id) => !unique.has(id))
  ) {
    throw new PagebldrError(
      "INVALID_DOCUMENT",
      `${label} order must contain every record exactly once.`,
    );
  }
}

export function buildDocumentIndex(input: PageDocument): DocumentIndex {
  const document = parseDocument(input);
  assertRecordKeysMatchIds("Element", document.elements);
  assertRecordKeysMatchIds("Class", document.classes);
  assertRecordKeysMatchIds("Variable", document.variables);
  assertOrderMatchesRecords("Class", document.classOrder, document.classes);
  assertOrderMatchesRecords(
    "Variable",
    document.variableOrder,
    document.variables,
  );

  const root = document.elements[document.rootId];
  if (!root) {
    throw new PagebldrError(
      "BROKEN_REFERENCE",
      `Root Element ${document.rootId} does not exist.`,
    );
  }

  const parentById = new Map<string, string | null>([[document.rootId, null]]);
  const indexById = new Map<string, number>([[document.rootId, 0]]);
  const depthById = new Map<string, number>();
  const descendantsById = new Map<string, ReadonlySet<string>>();
  const preorder: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (element: PageElement, depth: number): Set<string> => {
    if (depth > MAX_DOCUMENT_DEPTH) {
      throw new PagebldrError(
        "STRUCTURAL_LIMIT",
        `Document nesting exceeds ${MAX_DOCUMENT_DEPTH} levels.`,
      );
    }
    if (visiting.has(element.id)) {
      throw new PagebldrError(
        "CIRCULAR_NESTING",
        `Element ${element.id} creates a circular tree.`,
      );
    }
    if (visited.has(element.id)) {
      throw new PagebldrError(
        "INVALID_PARENT",
        `Element ${element.id} has more than one parent.`,
      );
    }
    visiting.add(element.id);
    visited.add(element.id);
    preorder.push(element.id);
    depthById.set(element.id, depth);
    const descendants = new Set<string>();

    element.children.forEach((childId, childIndex) => {
      const child = document.elements[childId];
      if (!child) {
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Element ${element.id} references missing child ${childId}.`,
        );
      }
      if (visiting.has(childId)) {
        throw new PagebldrError(
          "CIRCULAR_NESTING",
          `Element ${childId} creates a circular tree.`,
        );
      }
      if (parentById.has(childId)) {
        throw new PagebldrError(
          "INVALID_PARENT",
          `Element ${childId} has more than one parent.`,
        );
      }
      parentById.set(childId, element.id);
      indexById.set(childId, childIndex);
      descendants.add(childId);
      for (const descendantId of visit(child, depth + 1))
        descendants.add(descendantId);
    });
    visiting.delete(element.id);
    descendantsById.set(element.id, descendants);
    return descendants;
  };

  visit(root, 0);
  const orphanIds = Object.keys(document.elements).filter(
    (id) => !visited.has(id),
  );
  if (orphanIds.length > 0) {
    throw new PagebldrError(
      "INVALID_PARENT",
      `Document contains orphan Elements: ${orphanIds.join(", ")}.`,
      { details: { orphanIds } },
    );
  }

  for (const element of Object.values(document.elements)) {
    if (new Set(element.children).size !== element.children.length) {
      throw new PagebldrError(
        "INVALID_PARENT",
        `Element ${element.id} contains a child more than once.`,
      );
    }
    for (const classId of element.classIds) {
      if (!document.classes[classId]) {
        throw new PagebldrError(
          "BROKEN_REFERENCE",
          `Element ${element.id} references missing Class ${classId}.`,
        );
      }
    }
  }

  return { parentById, indexById, depthById, descendantsById, preorder };
}
