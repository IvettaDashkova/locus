"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type maplibregl from "maplibre-gl";

export type ControlsCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type MapContextValue = {
  map: maplibregl.Map | null;
  setMap: (map: maplibregl.Map | null) => void;
  controlsCorner: ControlsCorner;
  setControlsCorner: (corner: ControlsCorner) => void;
};

const MapContext = createContext<MapContextValue>({
  map: null,
  setMap: () => {},
  controlsCorner: "bottom-left",
  setControlsCorner: () => {},
});

/** Holds the shared MapLibre instance + where its controls sit, so modules can reuse one map. */
export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [controlsCorner, setControlsCorner] = useState<ControlsCorner>("bottom-left");
  return (
    <MapContext.Provider value={{ map, setMap, controlsCorner, setControlsCorner }}>
      {children}
    </MapContext.Provider>
  );
}

export const useMapContext = () => useContext(MapContext);
