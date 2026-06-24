"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FieldProps } from "@rjsf/utils";
import { MAP_STYLE } from "@/components/map/map-config";
import { useI18n } from "@/lib/i18n/provider";

type Point = { type: "Point"; coordinates: [number, number] };

/** RJSF custom field: click the map to set a GeoJSON Point (SRID 4326). */
export function GeoPointField(props: FieldProps) {
  const { formData, onChange, fieldPathId, schema, required } = props;
  const { t } = useI18n();
  // RJSF defaults an empty object field to `{}`; treat only a real GeoJSON Point as a value.
  const value = (formData as Point | undefined)?.type === "Point" ? (formData as Point) : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // RJSF v6 onChange is (value, path, …): the path scopes the update to THIS field (else it leaks
  // to the form root). Keep a stable emitter updated each render.
  const emitRef = useRef<(v: unknown) => void>(() => {});
  useEffect(() => {
    emitRef.current = (v: unknown) => onChange(v as never, fieldPathId.path);
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.1,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("click", (e) => {
      emitRef.current({ type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the marker in sync with the current value.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const coords = value?.type === "Point" ? value.coordinates : null;
    if (coords) {
      if (!markerRef.current) markerRef.current = new maplibregl.Marker({ color: "#ef4444" });
      markerRef.current.setLngLat(coords).addTo(map);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {schema.title}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {schema.description ? (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      ) : null}
      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-md border" />
      <p className="text-xs text-muted-foreground">
        {value?.coordinates
          ? `lng ${value.coordinates[0].toFixed(5)}, lat ${value.coordinates[1].toFixed(5)}`
          : t("geo.point.hint")}
      </p>
    </div>
  );
}
