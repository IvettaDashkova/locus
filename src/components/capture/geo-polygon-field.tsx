"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { area as turfArea } from "@turf/turf";
import type { FieldProps } from "@rjsf/utils";
import { MAP_STYLE } from "@/components/map/map-config";

type Polygon = { type: "Polygon"; coordinates: number[][][] };

/** RJSF custom field: draw a GeoJSON Polygon on the map (terra-draw), with live area (Turf). */
export function GeoPolygonField(props: FieldProps) {
  const { formData, onChange, fieldPathId, schema, required } = props;
  // RJSF defaults an empty object field to `{}`; treat only a real GeoJSON Polygon as a value.
  const value = (formData as Polygon | undefined)?.type === "Polygon" ? (formData as Polygon) : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  // RJSF v6 onChange is (value, path, …): the path scopes the update to THIS field (else it leaks
  // to the form root). Keep a stable emitter updated each render.
  const emitRef = useRef<(v: unknown) => void>(() => {});
  useEffect(() => {
    emitRef.current = (v: unknown) => onChange(v as never, fieldPathId.path);
  });

  const [areaM2, setAreaM2] = useState<number | null>(
    value ? Math.round(turfArea({ type: "Feature", geometry: value, properties: {} })) : null,
  );

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
    mapRef.current = map;

    map.on("load", () => {
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [new TerraDrawPolygonMode()],
      });
      draw.start();
      draw.setMode("polygon");
      draw.on("finish", (id) => {
        const feature = draw.getSnapshot().find((f) => f.id === id);
        if (feature && feature.geometry.type === "Polygon") {
          emitRef.current(feature.geometry as Polygon);
          setAreaM2(Math.round(turfArea(feature)));
        }
      });
      drawRef.current = draw;
    });

    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function clear() {
    drawRef.current?.clear();
    setAreaM2(null);
    emitRef.current(undefined);
  }

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
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {areaM2 != null
            ? `Area: ${areaM2.toLocaleString()} m²`
            : "Click to add points; click the first point to close."}
        </span>
        {value ? (
          <button type="button" onClick={clear} className="underline hover:text-foreground">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
