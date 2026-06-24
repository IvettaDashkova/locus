import type { StyleSpecification } from "maplibre-gl";

/**
 * Basemap style. OpenFreeMap `liberty` — OSM vector tiles, no key, no signup, unlimited.
 * Upgrade path is a one-line swap of this constant:
 *   - self-hosted / offline: a Protomaps `.pmtiles` style
 *   - raster fallback: an OSM raster style object
 * The rest of the MapLibre code is unchanged either way.
 */
export const MAP_STYLE: string | StyleSpecification =
  "https://tiles.openfreemap.org/styles/positron";
// (OpenFreeMap also serves `dark`, `liberty`, `bright` — swap here for a dark-mode map later.)

/** Default view: whole world, so any seeded sites are visible without panning. */
export const DEFAULT_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 1.4;
