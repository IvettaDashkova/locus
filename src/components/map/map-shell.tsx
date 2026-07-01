"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyleFor, DEFAULT_CENTER, DEFAULT_ZOOM, applyMapLanguage } from "./map-config";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme } from "@/components/theme/theme-provider";
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
  const { theme } = useTheme();
  const { controlsCorner } = useMapContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const controlsRef = useRef<{ nav: maplibregl.NavigationControl; attrib: maplibregl.AttributionControl } | null>(null);
  const onReadyRef = useRef(onReady);
  // Survives map recreation (theme switch) so the view doesn't jump back to the default.
  const viewRef = useRef<{ center: [number, number]; zoom: number }>({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  const [ready, setReady] = useState(false);

  // Keep the latest onReady without re-initializing the map.
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  // Create the map — and recreate it when the theme changes, so the basemap swaps light/dark.
  // Recreating (rather than setStyle) lets every feature layer re-attach via its own `[map]` effect.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleFor(theme),
      center: viewRef.current.center,
      zoom: viewRef.current.zoom,
      attributionControl: false,
    });
    mapRef.current = map;

    // MapLibre surfaces every tile fetch that gets aborted — which happens routinely when the map is
    // torn down and recreated (theme switch, route change, React StrictMode's double-mount in dev) —
    // as an AJAXError with `status: 0`. These are benign and self-heal on the next render, so keep
    // them out of the console; only genuine style/source errors get logged. Registering ANY error
    // listener also stops MapLibre's default `console.error` for these.
    map.on("error", (e) => {
      const err = e.error as (Error & { status?: number }) | undefined;
      if (err?.name === "AbortError" || err?.status === 0) return; // transient tile fetch abort
      console.error("map error:", err ?? e);
    });

    map.on("moveend", () => {
      viewRef.current = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() };
    });
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
  }, [theme]);

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
