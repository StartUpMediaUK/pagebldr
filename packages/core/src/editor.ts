import type { PageDocument, PageElement } from "./document-types.js";
import type { ElementDefinition } from "./element.js";
import type { StyleEngine } from "./styles.js";
import {
  executeCommand,
  type EditorCommand,
  type EditorTransaction,
} from "./commands.js";
import {
  commitCommand,
  createHistory,
  redoHistory,
  jumpHistory,
  undoHistory,
  type CommitOptions,
  type LocalHistory,
} from "./history.js";
import { diffDocuments, invertPatches } from "./patches.js";
import { PagebldrError } from "./types.js";
import {
  serializeStyles,
  serializeSubtree,
  type PagebldrClipboard,
  type PagebldrStyleClipboard,
} from "./clipboard.js";

export interface EditorEngine {
  readonly dispatch: (
    document: PageDocument,
    command: EditorCommand,
  ) => EditorTransaction;
  readonly dispatchMany: (
    document: PageDocument,
    commands: readonly EditorCommand[],
  ) => EditorTransaction;
  readonly history: {
    readonly create: (document: PageDocument, limit?: number) => LocalHistory;
    readonly commit: (
      history: LocalHistory,
      command: EditorCommand,
      options?: CommitOptions,
    ) => LocalHistory;
    readonly undo: (history: LocalHistory) => LocalHistory;
    readonly redo: (history: LocalHistory) => LocalHistory;
    readonly jump: (history: LocalHistory, position: number) => LocalHistory;
  };
  readonly clipboard: {
    readonly copy: (
      document: PageDocument,
      elementId: string,
    ) => PagebldrClipboard;
    readonly copyStyles: (
      document: PageDocument,
      elementId: string,
    ) => PagebldrStyleClipboard;
  };
  readonly can: (document: PageDocument, command: EditorCommand) => boolean;
  readonly selectors: {
    readonly element: (
      document: PageDocument,
      elementId: string,
    ) => PageElement | null;
    readonly canUndo: (history: LocalHistory) => boolean;
    readonly canRedo: (history: LocalHistory) => boolean;
  };
}

export function createEditor(
  definitions: ReadonlyMap<string, ElementDefinition>,
  styles: StyleEngine,
): EditorEngine {
  return Object.freeze({
    dispatch: (document: PageDocument, command: EditorCommand) =>
      executeCommand(document, command, definitions, styles),
    dispatchMany: (
      document: PageDocument,
      commands: readonly EditorCommand[],
    ) => {
      let current = document;
      const changed = new Set<string>();
      for (const command of commands) {
        const transaction = executeCommand(
          current,
          command,
          definitions,
          styles,
        );
        current = transaction.document;
        for (const id of transaction.changedElementIds) changed.add(id);
      }
      const forward = diffDocuments(document, current);
      if (forward.length === 0) {
        throw new PagebldrError(
          "INVALID_COMMAND",
          "The transaction did not change the Document.",
        );
      }
      return {
        label: "Transaction",
        document: current,
        forward,
        inverse: invertPatches(forward),
        changedElementIds: [...changed],
        command: commands.at(-1)?.type ?? "update-page",
      };
    },
    history: {
      create: createHistory,
      commit: (
        history: LocalHistory,
        command: EditorCommand,
        options?: CommitOptions,
      ) => commitCommand(history, command, definitions, styles, options),
      undo: (history: LocalHistory) =>
        undoHistory(history, definitions, styles),
      redo: (history: LocalHistory) =>
        redoHistory(history, definitions, styles),
      jump: (history: LocalHistory, position: number) =>
        jumpHistory(history, position, definitions, styles),
    },
    clipboard: { copy: serializeSubtree, copyStyles: serializeStyles },
    can: (document: PageDocument, command: EditorCommand) => {
      try {
        executeCommand(document, command, definitions, styles);
        return true;
      } catch {
        return false;
      }
    },
    selectors: {
      element: (document: PageDocument, elementId: string) =>
        document.elements[elementId] ?? null,
      canUndo: (history: LocalHistory) => history.past.length > 0,
      canRedo: (history: LocalHistory) => history.future.length > 0,
    },
  });
}
