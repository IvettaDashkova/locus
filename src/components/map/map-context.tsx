"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type maplibregl from "maplibre-gl";

type MapContextValue = {
  map: maplibregl.Map | null;
  setMap: (map: maplibregl.Map | null) => void;
};

const MapContext = createContext<MapContextValue>({ map: null, setMap: () => {} });

/** Holds the shared MapLibre instance so feature modules can add layers / flyTo the same map. */
export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  return <MapContext.Provider value={{ map, setMap }}>{children}</MapContext.Provider>;
}

export const useMapContext = () => useContext(MapContext);
