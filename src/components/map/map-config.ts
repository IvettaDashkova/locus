import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

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

/**
 * Switch map place-name labels to the user's language. OpenMapTiles vector tiles carry per-language
 * name fields (`name:uk`, `name:pl`, `name:en`); we prefer the chosen locale and fall back to the
 * latin/default name. Only rewrites symbol layers that already label by `name`.
 */
export function applyMapLanguage(map: MapLibreMap, locale: string): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const textField = (layer.layout as Record<string, unknown> | undefined)?.["text-field"];
    if (textField == null || !JSON.stringify(textField).includes("name")) continue;
    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", `name:${locale}`],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
  }
}
