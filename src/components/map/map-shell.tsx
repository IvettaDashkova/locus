"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM, applyMapLanguage } from "./map-config";
import { useI18n } from "@/lib/i18n/provider";
import { useMapContext } from "./map-context";

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
  const { locale } = useI18n();
  const { controlsCorner } = useMapContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const controlsRef = useRef<{ nav: maplibregl.NavigationControl; attrib: maplibregl.AttributionControl } | null>(null);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);

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
    mapRef.current = map;

    map.once("load", () => {
      onReadyRef.current?.(map);
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      controlsRef.current = null;
      setReady(false);
    };
  }, []);

  // Place (and reposition) the zoom + attribution controls at the module's chosen corner.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (controlsRef.current) {
      map.removeControl(controlsRef.current.nav);
      map.removeControl(controlsRef.current.attrib);
    }
    const nav = new maplibregl.NavigationControl({ showCompass: false });
    const attrib = new maplibregl.AttributionControl({ compact: true });
    map.addControl(nav, controlsCorner);
    map.addControl(attrib, controlsCorner);
    controlsRef.current = { nav, attrib };
  }, [ready, controlsCorner]);

  // Localize place-name labels to the selected language (and on every change).
  useEffect(() => {
    if (ready && mapRef.current) applyMapLanguage(mapRef.current, locale);
  }, [ready, locale]);

  return <div ref={containerRef} className={["locus-shell-map", className].filter(Boolean).join(" ")} />;
}
