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
  ResourceReference,
} from "@pagebldr/core";

import { CanvasDimensionsProvider } from "./canvas-dimensions-context.js";

export type EditorMode = "edit" | "preview" | "readOnly";
export type EditorViewport = "desktop" | "desktop-fill" | "tablet" | "mobile";

export interface EditorContextValue {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly viewport: EditorViewport;
  readonly selectedId: string | null;
  readonly selected: PageElement | null;
  readonly hoveredId: string | null;
  readonly previewing: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dispatch: (command: EditorCommand, coalesceKey?: string) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly select: (elementId: string | null) => void;
  readonly hover: (elementId: string | null) => void;
  readonly setPreviewing: (previewing: boolean) => void;
  readonly setViewport: (viewport: EditorViewport) => void;
  readonly resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export interface EditorProviderProps {
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly onChange: (event: DocumentChangeEvent) => void;
  readonly resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
  readonly children: ReactNode;
}

export function EditorProvider({
  builder,
  children,
  document,
  mode,
  onChange,
  resolveApplicationDestination,
}: EditorProviderProps) {
  const [history, setHistory] = useState<LocalHistory>(() =>
    builder.editor.history.create(document),
  );
  const [selectedId, setSelectedId] = useState<string | null>(document.rootId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(mode === "preview");
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

  useEffect(() => setPreviewing(mode === "preview"), [mode]);

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
      hoveredId,
      previewing,
      canUndo: builder.editor.selectors.canUndo(history),
      canRedo: builder.editor.selectors.canRedo(history),
      dispatch,
      undo,
      redo,
      select: setSelectedId,
      hover: setHoveredId,
      setPreviewing,
      setViewport,
      ...(resolveApplicationDestination
        ? { resolveApplicationDestination }
        : {}),
    }),
    [
      builder,
      dispatch,
      history,
      hoveredId,
      mode,
      previewing,
      redo,
      resolveApplicationDestination,
      selectedId,
      undo,
      viewport,
    ],
  );

  return (
    <EditorContext.Provider value={value}>
      <CanvasDimensionsProvider>{children}</CanvasDimensionsProvider>
    </EditorContext.Provider>
  );
}

export function usePagebldrEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context)
    throw new Error("usePagebldrEditor must be used inside PagebldrEditor.");
  return context;
}
