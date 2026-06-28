"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { bbox } from "@turf/turf";
import { useMapContext } from "@/components/map/map-context";
import { removeMapLayers } from "@/components/map/map-cleanup";

export type AskSource = {
  n: number;
  title: string | null;
  url: string | null;
  source: string;
  license: string | null;
  coords: [number, number] | null;
};

const SRC = "locus-ask";
const POINTS = `${SRC}-points`;
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

function popupHtml(s: AskSource): string {
  const meta = `${esc(s.source)}${s.license ? ` · ${esc(s.license)}` : ""}`;
  return `<div class="locus-popup"><div class="title">[${s.n}] ${esc(s.title ?? s.source)}</div><div class="form">${meta}</div></div>`;
}

/** Plots the cited Ask sources on the shared map (hover tooltip), fitting the view to them. */
export function AskPinsLayer({ sources }: { sources: AskSource[] }) {
  const { map } = useMapContext();
  const ref = useRef(sources);
  useEffect(() => {
    ref.current = sources;
  });

  useEffect(() => {
    if (!map) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
    const hide = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    const move = (e: MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: [POINTS] })[0];
      const n = f?.properties?.n as number | undefined;
      const s = n != null ? ref.current.find((x) => x.n === n) : undefined;
      if (!s || f?.geometry.type !== "Point") {
        hide();
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      popup.setLngLat(f.geometry.coordinates as [number, number]).setHTML(popupHtml(s)).addTo(map);
    };
    const setup = () => {
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: POINTS,
          type: "circle",
          source: SRC,
          paint: {
            "circle-radius": 7,
            "circle-color": ACCENT,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
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
      removeMapLayers(map, [POINTS], [SRC]);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      const pts = sources.filter((s) => s.coords) as (AskSource & { coords: [number, number] })[];
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: pts.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: s.coords },
          properties: { n: s.n },
        })),
      };
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(data);
      if (pts.length === 1) {
        map.flyTo({ center: pts[0].coords, zoom: 6 });
      } else if (pts.length > 1) {
        const [minX, minY, maxX, maxY] = bbox(data);
        map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 90, maxZoom: 8 });
      }
    });
  }, [map, sources]);

  return null;
}
