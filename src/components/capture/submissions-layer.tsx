"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { bbox } from "@turf/turf";
import { useMapContext } from "@/components/map/map-context";
import type { SubmissionItem } from "./submissions-list";

const SRC = "locus-submissions";
const POINTS = `${SRC}-points`;
const POLY_FILL = `${SRC}-poly-fill`;
const POLY_LINE = `${SRC}-poly-line`;
const ACCENT = "#6d4aff";

/**
 * Run `cb` once the style is ready — handles the map having already fired `load`. Uses `idle`
 * (which reliably fires after the style finishes, unlike `load`/`styledata` which we may miss or
 * which fire before tiles/sources settle). Returns cleanup.
 */
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

function popupHtml(item: SubmissionItem): string {
  const rows = Object.entries(item.data ?? {})
    .filter(([, v]) => v != null && typeof v !== "object")
    .slice(0, 6)
    .map(
      ([k, v]) =>
        `<div class="row"><span class="k">${esc(k)}</span><span class="v">${esc(String(v))}</span></div>`,
    )
    .join("");
  const title = esc(item.siteName ?? item.formName);
  return `<div class="locus-popup"><div class="title">${title}</div><div class="form">${esc(item.formName)}</div>${rows}</div>`;
}

export function SubmissionsLayer({
  items,
  focusId,
  onSelect,
}: {
  items: SubmissionItem[];
  focusId: string | null;
  onSelect?: (item: SubmissionItem) => void;
}) {
  const { map } = useMapContext();
  const itemsRef = useRef(items);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    itemsRef.current = items;
    onSelectRef.current = onSelect;
  });

  // Add source + layers + interaction handlers once the style is ready.
  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
    const interactive = [POINTS, POLY_FILL];

    const hidePopup = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    // Map-level handlers + queryRenderedFeatures (robust where layer-scoped events don't fire).
    const onMove = (e: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: interactive })[0];
      const id = feature?.properties?.id as string | undefined;
      const item = id ? itemsRef.current.find((i) => i.id === id) : undefined;
      if (!item) {
        hidePopup();
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const lngLat =
        feature.geometry.type === "Point" ? (feature.geometry.coordinates as [number, number]) : e.lngLat;
      popup.setLngLat(lngLat).setHTML(popupHtml(item)).addTo(map);
    };
    const onClick = (e: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: interactive })[0];
      const id = feature?.properties?.id as string | undefined;
      const item = id ? itemsRef.current.find((i) => i.id === id) : undefined;
      if (item) onSelectRef.current?.(item);
    };

    const setup = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: POLY_FILL,
          type: "fill",
          source: SRC,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": ACCENT, "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: POLY_LINE,
          type: "line",
          source: SRC,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "line-color": ACCENT, "line-width": 2 },
        });
        map.addLayer({
          id: POINTS,
          type: "circle",
          source: SRC,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 6,
            "circle-color": ACCENT,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        // initial data
        (map.getSource(SRC) as GeoJSONSource).setData(toCollection(itemsRef.current));
      }
      map.on("mousemove", onMove);
      map.on("mouseout", hidePopup);
      map.on("click", onClick);
    };

    const cleanupReady = onStyleReady(map, setup);

    return () => {
      cleanupReady();
      popup.remove();
      map.off("mousemove", onMove);
      map.off("mouseout", hidePopup);
      map.off("click", onClick);
    };
  }, [map]);

  // Update source data when submissions change.
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      const src = map.getSource(SRC) as GeoJSONSource | undefined;
      if (src) src.setData(toCollection(items));
    });
  }, [map, items]);

  // Fly to the focused submission.
  useEffect(() => {
    if (!map || !focusId) return;
    const geom = items.find((i) => i.id === focusId)?.geometry;
    if (!geom) return;
    if (geom.type === "Point") {
      map.flyTo({ center: geom.coordinates as [number, number], zoom: 9 });
    } else {
      const [minX, minY, maxX, maxY] = bbox(geom as GeoJSON.Geometry);
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, maxZoom: 12 });
    }
  }, [map, focusId, items]);

  return null;
}

function toCollection(items: SubmissionItem[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items
      .filter((i) => i.geometry)
      .map((i) => ({
        type: "Feature",
        id: i.id,
        geometry: i.geometry as GeoJSON.Geometry,
        properties: { id: i.id, label: i.siteName ?? i.formName },
      })),
  };
}
