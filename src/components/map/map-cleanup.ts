import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Remove the given layers and sources from the shared map, ignoring any that are already gone.
 * Layers must go before their source. Call this from a layer component's unmount cleanup so its
 * features don't linger on the persistent map when the user switches modules.
 */
export function removeMapLayers(map: MapLibreMap, layerIds: string[], sourceIds: string[]) {
  for (const id of layerIds) {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
    } catch {
      /* style may already be torn down */
    }
  }
  for (const id of sourceIds) {
    try {
      if (map.getSource(id)) map.removeSource(id);
    } catch {
      /* style may already be torn down */
    }
  }
}
