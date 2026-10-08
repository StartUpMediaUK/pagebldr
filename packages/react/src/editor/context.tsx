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
  StyleState,
} from "@pagebldr/core";

import { CanvasDimensionsProvider } from "./canvas-dimensions-context.js";
import type { EditorLibrarySource } from "./library-source.js";

export type EditorMode = "edit" | "preview" | "readOnly";
export type EditorViewport = "desktop" | "desktop-fill" | "tablet" | "mobile";

export interface ApplicationDestinationOption {
  readonly label: string;
  readonly reference: ResourceReference;
  readonly description?: string;
}

export interface EditorContextValue {
  readonly librarySource: EditorLibrarySource | undefined;
  readonly libraryVersion: number;
  readonly refreshLibrary: () => void;
  readonly canvasFitVersion: number;
  readonly fitCanvas: () => void;
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly viewport: EditorViewport;
  readonly selectedId: string | null;
  readonly selected: PageElement | null;
  readonly hoveredId: string | null;
  readonly previewing: boolean;
  readonly styleState: StyleState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly applicationDestinations: readonly ApplicationDestinationOption[];
  readonly dispatch: (command: EditorCommand, coalesceKey?: string) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly select: (elementId: string | null) => void;
  readonly hover: (elementId: string | null) => void;
  readonly setPreviewing: (previewing: boolean) => void;
  readonly setStyleState: (state: StyleState) => void;
  readonly setViewport: (viewport: EditorViewport) => void;
  readonly resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
}

const EditorContext = createContext<EditorContextValue | null>(null);
const SelectionVersionContext = createContext(0);
interface LibraryBrowsingState {
  readonly query: string;
  readonly tab: string;
  readonly category: string;
  readonly templateSource: string;
  readonly favouritesOnly: boolean;
}
const LibraryBrowsingContext = createContext<{
  readonly value: LibraryBrowsingState;
  readonly update: React.Dispatch<React.SetStateAction<LibraryBrowsingState>>;
} | null>(null);
export function useLibraryBrowsing() {
  const state = useContext(LibraryBrowsingContext);
  if (!state) throw new Error("Library browsing requires editor context.");
  return state;
}
/** Private UI notification; repeated selections are not Document mutations. */
export function useEditorSelectionVersion(): number {
  return useContext(SelectionVersionContext);
}

export interface EditorProviderProps {
  readonly librarySource?: EditorLibrarySource;
  readonly builder: Pagebldr;
  readonly document: PageDocument;
  readonly mode: EditorMode;
  readonly onChange: (event: DocumentChangeEvent) => void;
  readonly applicationDestinations: readonly ApplicationDestinationOption[];
  readonly resolveApplicationDestination?: (
    reference: ResourceReference,
  ) => string | null;
  readonly children: ReactNode;
}

export function EditorProvider({
  librarySource,
  applicationDestinations,
  builder,
  children,
  document,
  mode,
  onChange,
  resolveApplicationDestination,
}: EditorProviderProps) {
  const [libraryBrowsing, setLibraryBrowsing] = useState<LibraryBrowsingState>({
    query: "",
    tab: "elements",
    category: "all",
    templateSource: "featured",
    favouritesOnly: false,
  });
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [canvasFitVersion, setCanvasFitVersion] = useState(0);
  const fitCanvas = useCallback(
    () => setCanvasFitVersion((value) => value + 1),
    [],
  );
  const refreshLibrary = useCallback(
    () => setLibraryVersion((value) => value + 1),
    [],
  );
  const [history, setHistory] = useState<LocalHistory>(() =>
    builder.editor.history.create(document),
  );
  const [selectedId, setSelectedId] = useState<string | null>(document.rootId);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const select = useCallback((elementId: string | null) => {
    setSelectedId(elementId);
    setSelectionVersion((current) => current + 1);
  }, []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(mode === "preview");
  const [styleState, setStyleState] = useState<StyleState>("normal");
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
      librarySource,
      libraryVersion,
      refreshLibrary,
      canvasFitVersion,
      fitCanvas,
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
      styleState,
      canUndo: builder.editor.selectors.canUndo(history),
      canRedo: builder.editor.selectors.canRedo(history),
      applicationDestinations,
      dispatch,
      undo,
      redo,
      select,
      hover: setHoveredId,
      setPreviewing,
      setStyleState,
      setViewport,
      ...(resolveApplicationDestination
        ? { resolveApplicationDestination }
        : {}),
    }),
    [
      librarySource,
      libraryVersion,
      refreshLibrary,
      canvasFitVersion,
      fitCanvas,
      builder,
      applicationDestinations,
      dispatch,
      history,
      hoveredId,
      mode,
      previewing,
      redo,
      resolveApplicationDestination,
      select,
      selectedId,
      styleState,
      undo,
      viewport,
    ],
  );

  return (
    <SelectionVersionContext.Provider value={selectionVersion}>
      <EditorContext.Provider value={value}>
        <LibraryBrowsingContext.Provider
          value={{ value: libraryBrowsing, update: setLibraryBrowsing }}
        >
          <CanvasDimensionsProvider>{children}</CanvasDimensionsProvider>
        </LibraryBrowsingContext.Provider>
      </EditorContext.Provider>
    </SelectionVersionContext.Provider>
  );
}

export function usePagebldrEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context)
    throw new Error("usePagebldrEditor must be used inside PagebldrEditor.");
  return context;
}

/** Private optional context for components also usable by ordinary Hosts. */
export function useOptionalPagebldrEditor(): EditorContextValue | null {
  return useContext(EditorContext);
}
