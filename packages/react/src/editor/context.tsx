"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  DocumentChangeEvent,
  EditorCommand,
  LocalHistory,
  Pagebldr,
  PageDocument,
  PageElement,
} from "@pagebldr/core";

export type EditorMode = "edit" | "preview" | "readOnly";
export type EditorViewport = "desktop" | "tablet" | "mobile";

export interface EditorContextValue {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly viewport: EditorViewport;
  readonly selectedId: string | null;
  readonly selected: PageElement | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dispatch: (command: EditorCommand, coalesceKey?: string) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly select: (elementId: string | null) => void;
  readonly setViewport: (viewport: EditorViewport) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export interface EditorProviderProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly onChange: (event: DocumentChangeEvent) => void;
  readonly children: ReactNode;
}

export function EditorProvider({
  builder,
  children,
  document,
  mode,
  onChange,
}: EditorProviderProps) {
  const [history, setHistory] = useState<LocalHistory>(() =>
    builder.editor.history.create(document),
  );
  const [selectedId, setSelectedId] = useState<string | null>(document.rootId);
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const emitted = useRef<PageDocument | null>(null);

  useEffect(() => {
    if (emitted.current === document) {
      emitted.current = null;
      return;
    }
    setHistory(builder.editor.history.create(document));
    setSelectedId((current) =>
      current && document.elements[current] ? current : document.rootId,
    );
  }, [builder, document]);

  const emit = useCallback(
    (next: LocalHistory, event: Omit<DocumentChangeEvent, "document">) => {
      emitted.current = next.present;
      setHistory(next);
      onChange({ ...event, document: next.present });
    },
    [onChange],
  );

  const dispatch = useCallback(
    (command: EditorCommand, coalesceKey?: string) => {
      if (mode !== "edit") return;
      const next = builder.editor.history.commit(history, command, {
        ...(coalesceKey ? { coalesceKey } : {}),
      });
      const entry = next.past.at(-1)!;
      emit(next, {
        command: command.type,
        label: entry.label,
        changedElementIds: entry.changedElementIds,
      });
    },
    [builder, emit, history, mode],
  );

  const undo = useCallback(() => {
    if (!builder.editor.selectors.canUndo(history) || mode !== "edit") return;
    const next = builder.editor.history.undo(history);
    emit(next, {
      command: history.past.at(-1)!.command,
      label: "Undo",
      changedElementIds: history.past.at(-1)!.changedElementIds,
    });
  }, [builder, emit, history, mode]);

  const redo = useCallback(() => {
    if (!builder.editor.selectors.canRedo(history) || mode !== "edit") return;
    const next = builder.editor.history.redo(history);
    emit(next, {
      command: history.future.at(-1)!.command,
      label: "Redo",
      changedElementIds: history.future.at(-1)!.changedElementIds,
    });
  }, [builder, emit, history, mode]);

  const value = useMemo<EditorContextValue>(
    () => ({
      builder,
      document: history.present,
      mode,
      viewport,
      selectedId,
      selected: selectedId
        ? (history.present.elements[selectedId] ?? null)
        : null,
      canUndo: builder.editor.selectors.canUndo(history),
      canRedo: builder.editor.selectors.canRedo(history),
      dispatch,
      undo,
      redo,
      select: setSelectedId,
      setViewport,
    }),
    [builder, dispatch, history, mode, redo, selectedId, undo, viewport],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function usePagebldrEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context)
    throw new Error("usePagebldrEditor must be used inside PagebldrEditor.");
  return context;
}
