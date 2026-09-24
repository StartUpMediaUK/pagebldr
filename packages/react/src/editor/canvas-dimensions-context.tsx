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

interface CanvasDimensionsContextValue {
  readonly visible: boolean;
  readonly show: () => void;
  readonly hideSoon: () => void;
}

const CanvasDimensionsContext =
  createContext<CanvasDimensionsContextValue | null>(null);

export function CanvasDimensionsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setVisible(true);
  }, []);

  const hideSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setVisible(false);
    }, 2_000);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(
    () => ({ visible, show, hideSoon }),
    [hideSoon, show, visible],
  );

  return (
    <CanvasDimensionsContext.Provider value={value}>
      {children}
    </CanvasDimensionsContext.Provider>
  );
}

export function useCanvasDimensions(): CanvasDimensionsContextValue {
  const context = useContext(CanvasDimensionsContext);
  if (!context)
    throw new Error(
      "useCanvasDimensions must be used inside CanvasDimensionsProvider.",
    );
  return context;
}
