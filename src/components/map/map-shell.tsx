"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM } from "./map-config";

type MapShellProps = {
  className?: string;
  /** Called once the map instance exists, so later modules can add sources/layers/overlays. */
  onReady?: (map: maplibregl.Map) => void;
};

/**
 * MapLibre GL map on OpenFreeMap tiles. Client-only (needs `window`); the map instance is exposed
 * via onReady so feature modules (pins, routes, isochrones, Deck.gl overlay) can attach to it.
 */
export function MapShell({ className, onReady }: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onReadyRef = useRef(onReady);

  // Keep the latest onReady without re-initializing the map.
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    // Bottom-left keeps controls clear of module panels that overlay the right/top of the map.
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    map.once("load", () => onReadyRef.current?.(map));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={["locus-shell-map", className].filter(Boolean).join(" ")} />;
}
