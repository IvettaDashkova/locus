"use client";

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMapContext } from "@/components/map/map-context";
import type { TrackSummary, TrackDetail } from "@/lib/tracks/queries";

const ACCENT = "#6d4aff";
const STOP = "#f59e0b";

const OVERVIEW = "locus-tracks-overview";
const HEAT = "locus-tracks-heat";
const PATH = "locus-track-path";
const STOPS = "locus-track-stops";
const HEAD = "locus-track-head";

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
 * All Tracks map rendering: faint overview lines for every track, an optional multi-track density
 * heatmap, and — when one track is selected — its highlighted path, stop markers, and the animated
 * playback head. Layers are added once and fed new data via setData on prop changes (same idiom as
 * the Act results layer), so they survive a basemap/theme swap cleanly.
 */
export function TracksLayer({
  tracks,
  selected,
  heatmap,
  showHeatmap,
  playhead,
}: {
  tracks: TrackSummary[];
  selected: TrackDetail | null;
  heatmap: GeoJSON.FeatureCollection | null;
  showHeatmap: boolean;
  playhead: [number, number] | null;
}) {
  const { map } = useMapContext();

  // One-time layer setup.
  useEffect(() => {
    if (!map) return;
    const setup = () => {
      if (map.getSource(OVERVIEW)) return;
      map.addSource(OVERVIEW, { type: "geojson", data: empty });
      map.addSource(HEAT, { type: "geojson", data: empty });
      map.addSource(PATH, { type: "geojson", data: empty });
      map.addSource(STOPS, { type: "geojson", data: empty });
      map.addSource(HEAD, { type: "geojson", data: empty });

      map.addLayer({
        id: HEAT,
        type: "heatmap",
        source: HEAT,
        paint: {
          "heatmap-radius": 18,
          "heatmap-intensity": 0.8,
          "heatmap-opacity": 0.75,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#312e81",
            0.4, "#4f46e5",
            0.6, "#7c3aed",
            0.8, "#db2777",
            1, "#f59e0b",
          ],
        },
      });
      map.addLayer({
        id: OVERVIEW,
        type: "line",
        source: OVERVIEW,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ACCENT, "line-width": 2, "line-opacity": 0.35 },
      });
      map.addLayer({
        id: PATH,
        type: "line",
        source: PATH,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ACCENT, "line-width": 4, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: STOPS,
        type: "circle",
        source: STOPS,
        paint: {
          "circle-radius": 6,
          "circle-color": STOP,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: HEAD,
        type: "circle",
        source: HEAD,
        paint: {
          "circle-radius": 8,
          "circle-color": ACCENT,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 3,
        },
      });
    };
    return onStyleReady(map, setup);
  }, [map]);

  // Overview lines for all tracks.
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      setData(map, OVERVIEW, {
        type: "FeatureCollection",
        features: tracks
          .filter((t) => t.path)
          .map((t) => ({ type: "Feature", geometry: t.path as GeoJSON.LineString, properties: { id: t.id } })),
      });
    });
  }, [map, tracks]);

  // Density heatmap (overview only).
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      const show = showHeatmap && !selected && heatmap;
      setData(map, HEAT, show ? heatmap! : empty);
    });
  }, [map, heatmap, showHeatmap, selected]);

  // Selected track: path + stop markers, and fit the view to it.
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      if (!selected) {
        setData(map, PATH, empty);
        setData(map, STOPS, empty);
        return;
      }
      setData(map, PATH, selected.track.path ?? empty);
      setData(map, STOPS, {
        type: "FeatureCollection",
        features: selected.segments
          .filter((s) => s.kind === "stop")
          .map((s) => ({ type: "Feature", geometry: s.geometry, properties: { seq: s.seq } })),
      });
      const b = selected.track.bbox;
      if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 15, duration: 700 });
    });
  }, [map, selected]);

  // Animated playback head.
  useEffect(() => {
    if (!map) return;
    return onStyleReady(map, () => {
      setData(
        map,
        HEAD,
        playhead
          ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: playhead }, properties: {} }] }
          : empty,
      );
    });
  }, [map, playhead]);

  return null;
}
