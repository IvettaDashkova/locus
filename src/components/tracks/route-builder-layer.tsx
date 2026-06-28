"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useMapContext } from "@/components/map/map-context";
import { removeMapLayers } from "@/components/map/map-cleanup";

const ACCENT = "#6d4aff";
const SRC = "locus-route-build";
const LINE = `${SRC}-line`;
const PTS = `${SRC}-pts`;
const LABELS = `${SRC}-labels`;

function onStyleReady(map: MapLibreMap, cb: () => void): () => void {
  if (map.isStyleLoaded()) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  map.once("idle", handler);
  return () => map.off("idle", handler);
}

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const setData = (map: MapLibreMap, id: string, data: GeoJSON.GeoJSON) =>
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

/**
 * Route-builder overlay: while `active`, clicking the map appends a waypoint (reported via `onAdd`),
 * and the in-progress polyline + numbered vertices are drawn. Pure rendering + a click subscription;
 * the waypoint list itself is owned by the workspace so Undo/Clear/Save stay simple.
 */
export function RouteBuilderLayer({
  active,
  waypoints,
  routedPath,
  onAdd,
}: {
  active: boolean;
  waypoints: [number, number][];
  /** The actual path the route follows (e.g. sea-routed for boats); falls back to straight waypoints. */
  routedPath: [number, number][] | null;
  onAdd: (lng: number, lat: number) => void;
}) {
  const { map } = useMapContext();
  const onAddRef = useRef(onAdd);
  useEffect(() => {
    onAddRef.current = onAdd;
  });

  // One-time layer setup.
  useEffect(() => {
    if (!map) return;
    const cleanupReady = onStyleReady(map, () => {
      if (map.getSource(SRC)) return;
      map.addSource(SRC, { type: "geojson", data: empty });
      map.addSource(PTS, { type: "geojson", data: empty });
      map.addLayer({
        id: LINE,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ACCENT, "line-width": 3, "line-dasharray": [2, 1] },
      });
      map.addLayer({
        id: PTS,
        type: "circle",
        source: PTS,
        paint: { "circle-radius": 7, "circle-color": ACCENT, "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
      });
      map.addLayer({
        id: LABELS,
        type: "symbol",
        source: PTS,
        layout: { "text-field": ["get", "n"], "text-size": 11, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#fff" },
      });
    });
    return () => {
      cleanupReady();
      removeMapLayers(map, [LINE, PTS, LABELS], [SRC, PTS]);
    };
  }, [map]);

  // Click-to-add + crosshair cursor while active.
  useEffect(() => {
    if (!map || !active) return;
    const handler = (e: MapMouseEvent) => onAddRef.current(e.lngLat.lng, e.lngLat.lat);
    map.on("click", handler);
    map.doubleClickZoom.disable(); // a double click is two nearby waypoints, not a zoom
    const prevCursor = map.getCanvas().style.cursor;
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", handler);
      try {
        map.doubleClickZoom.enable();
        map.getCanvas().style.cursor = prevCursor;
      } catch {
        /* map may be gone */
      }
    };
  }, [map, active]);

  // Render the current route: the line follows `routedPath` (sea route for boats) when available,
  // else the straight waypoints; the numbered vertices are always the user's clicked waypoints.
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      if (!active || waypoints.length === 0) {
        setData(map, SRC, empty);
        setData(map, PTS, empty);
        return;
      }
      const line = routedPath && routedPath.length >= 2 ? routedPath : waypoints;
      setData(map, SRC, {
        type: "FeatureCollection",
        features: line.length >= 2 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} }] : [],
      });
      setData(map, PTS, {
        type: "FeatureCollection",
        features: waypoints.map((c, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { n: String(i + 1) } })),
      });
    });
  }, [map, active, waypoints, routedPath]);

  return null;
}
