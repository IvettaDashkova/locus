"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { bbox } from "@turf/turf";
import { useMapContext } from "@/components/map/map-context";

const SRC = "locus-act";
const POINTS = `${SRC}-points`;
const LINES = `${SRC}-lines`;
const FILL = `${SRC}-fill`;
const OUTLINE = `${SRC}-outline`;
const ACCENT = "#6d4aff";

function onStyleReady(map: MapLibreMap, cb: () => void): () => void {
  if (map.isStyleLoaded()) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  map.once("idle", handler);
  return () => map.off("idle", handler);
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Renders agent tool results (points, routes, isochrones) on the shared map with hover tooltips. */
export function ActResultsLayer({ features }: { features: GeoJSON.Feature[] }) {
  const { map } = useMapContext();

  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    const layers = [POINTS, LINES, FILL];
    const hide = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    const move = (e: MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers })[0];
      const label = f?.properties?.label as string | undefined;
      if (!label) {
        hide();
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const kind = (f.properties?.kind as string) ?? "";
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<div class="locus-popup"><div class="title">${esc(label)}</div><div class="form">${esc(kind)}</div></div>`)
        .addTo(map);
    };
    const setup = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: FILL, type: "fill", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ACCENT, "fill-opacity": 0.15 } });
        map.addLayer({ id: OUTLINE, type: "line", source: SRC, filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": ACCENT, "line-width": 2, "line-dasharray": [2, 1] } });
        map.addLayer({ id: LINES, type: "line", source: SRC, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": ACCENT, "line-width": 4, "line-opacity": 0.85 } });
        map.addLayer({ id: POINTS, type: "circle", source: SRC, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 6, "circle-color": ACCENT, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      }
      map.on("mousemove", move);
      map.on("mouseout", hide);
    };
    const cleanup = onStyleReady(map, setup);
    return () => {
      cleanup();
      popup.remove();
      map.off("mousemove", move);
      map.off("mouseout", hide);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(data);
      if (features.length) {
        const [minX, minY, maxX, maxY] = bbox(data);
        if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
          map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 90, maxZoom: 12, duration: 600 });
        }
      }
    });
  }, [map, features]);

  return null;
}
