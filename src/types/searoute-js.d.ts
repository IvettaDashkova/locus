declare module "searoute-js" {
  /** Eurostat sea-route shortest path between two GeoJSON Point Features (units default "nm"). */
  const searoute: (
    origin: GeoJSON.Feature<GeoJSON.Point>,
    destination: GeoJSON.Feature<GeoJSON.Point>,
    units?: "nm" | "kilometers" | "miles" | "degrees" | "radians",
  ) => GeoJSON.Feature<GeoJSON.LineString> | null;
  export default searoute;
}
