import type { PageDocument } from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import type { StyleEngine } from "./styles.js";
import {
  executeCommand,
  type EditorCommand,
  type EditorTransaction,
} from "./commands.js";
import { applyPatches, diffDocuments, invertPatches } from "./patches.js";
import { assertValidDocument } from "./validation.js";

export interface HistoryEntry extends EditorTransaction {
  readonly timestamp: number;
  readonly coalesceKey: string | null;
}
export interface LocalHistory {
  readonly present: PageDocument;
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
  readonly limit: number;
}
export interface CommitOptions {
  readonly coalesceKey?: string | null;
  readonly timestamp?: number;
  readonly coalesceWindowMs?: number;
}

export function createHistory(
  document: PageDocument,
  limit = 100,
): LocalHistory {
  return { present: structuredClone(document), past: [], future: [], limit };
}

export function commitCommand(
  history: LocalHistory,
  command: EditorCommand,
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
  options: CommitOptions = {},
): LocalHistory {
  const timestamp = options.timestamp ?? Date.now();
  const coalesceKey = options.coalesceKey ?? null;
  const transaction = executeCommand(
    history.present,
    command,
    definitions,
    styles,
  );
  const previous = history.past.at(-1);
  const coalesce =
    coalesceKey !== null &&
    previous?.coalesceKey === coalesceKey &&
    timestamp - previous.timestamp <= (options.coalesceWindowMs ?? 750);
  let past: readonly HistoryEntry[];
  if (coalesce && previous) {
    const base = applyPatches(history.present, previous.inverse);
    const forward = diffDocuments(base, transaction.document);
    past = [
      ...history.past.slice(0, -1),
      {
        ...transaction,
        forward,
        inverse: invertPatches(forward),
        timestamp,
        coalesceKey,
      },
    ];
  } else
    past = [...history.past, { ...transaction, timestamp, coalesceKey }].slice(
      -history.limit,
    );
  return { ...history, present: transaction.document, past, future: [] };
}

export function undoHistory(
  history: LocalHistory,
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): LocalHistory {
  const entry = history.past.at(-1);
  if (!entry) return history;
  const present = applyPatches(history.present, entry.inverse);
  assertValidDocument(present, definitions, styles);
  return {
    ...history,
    present,
    past: history.past.slice(0, -1),
    future: [entry, ...history.future],
  };
}

export function redoHistory(
  history: LocalHistory,
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): LocalHistory {
  const [entry, ...future] = history.future;
  if (!entry) return history;
  const present = applyPatches(history.present, entry.forward);
  assertValidDocument(present, definitions, styles);
  return { ...history, present, past: [...history.past, entry], future };
}

export function jumpHistory(
  history: LocalHistory,
  position: number,
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): LocalHistory {
  const total = history.past.length + history.future.length;
  const target = Math.max(0, Math.min(total, Math.trunc(position)));
  let next = history;
  while (next.past.length > target)
    next = undoHistory(next, definitions, styles);
  while (next.past.length < target)
    next = redoHistory(next, definitions, styles);
  return next;
}
