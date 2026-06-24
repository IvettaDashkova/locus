"use client";

import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { bbox } from "@turf/turf";
import { useMapContext } from "@/components/map/map-context";
import type { SubmissionItem } from "./submissions-list";

const SRC = "locus-submissions";
const ACCENT = "#6d4aff";

/** Renders submission points + polygons on the shared map and flies to the focused one. */
export function SubmissionsLayer({ items, focusId }: { items: SubmissionItem[]; focusId: string | null }) {
  const { map } = useMapContext();

  useEffect(() => {
    if (!map) return;
    const data = {
      type: "FeatureCollection" as const,
      features: items
        .filter((i) => i.geometry)
        .map((i) => ({
          type: "Feature" as const,
          id: i.id,
          geometry: i.geometry as GeoJSON.Geometry,
          properties: { id: i.id, label: i.siteName ?? i.formName },
        })),
    };

    const apply = () => {
      const existing = map.getSource(SRC) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      map.addSource(SRC, { type: "geojson", data });
      map.addLayer({
        id: `${SRC}-poly-fill`,
        type: "fill",
        source: SRC,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": ACCENT, "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: `${SRC}-poly-line`,
        type: "line",
        source: SRC,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ACCENT, "line-width": 2 },
      });
      map.addLayer({
        id: `${SRC}-points`,
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
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [map, items]);

  useEffect(() => {
    if (!map || !focusId) return;
    const item = items.find((i) => i.id === focusId);
    const geom = item?.geometry;
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
