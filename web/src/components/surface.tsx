"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Surface = "light" | "dark";

const SurfaceContext = createContext<{ surface: Surface; setSurface: (surface: Surface) => void }>({
  surface: "light",
  setSurface: () => undefined,
});

/** Which look the shared chrome (header, footer, page background) uses: the U2 landing is dark, the app light. */
export function SurfaceProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<Surface>("light");
  const value = useMemo(() => ({ surface, setSurface }), [surface]);
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useSurface(): Surface {
  return useContext(SurfaceContext).surface;
}

/** Turns the chrome dark while the calling component is mounted, and back to light when it unmounts. */
export function useDarkSurface(): void {
  const { setSurface } = useContext(SurfaceContext);
  useEffect(() => {
    setSurface("dark");
    return () => setSurface("light");
  }, [setSurface]);
}
