import { describe, it, expect } from "vitest";
import { parseGpx, parseGeoJson, parseTrack } from "./parse";

describe("parseGpx", () => {
  const gpx = `<?xml version="1.0"?><gpx><trk><name>Test Walk</name><trkseg>
    <trkpt lat="50.45" lon="30.52"><ele>180</ele><time>2026-01-01T00:00:00Z</time></trkpt>
    <trkpt lat="50.46" lon="30.53"><ele>190</ele><time>2026-01-01T00:01:00Z</time></trkpt>
  </trkseg></trk></gpx>`;

  it("parses trkpts with name, elevation, and time", () => {
    const t = parseGpx(gpx);
    expect(t.name).toBe("Test Walk");
    expect(t.source).toBe("gpx");
    expect(t.points).toHaveLength(2);
    expect(t.points[0].lng).toBe(30.52);
    expect(t.points[0].lat).toBe(50.45);
    expect(t.points[0].elevation).toBe(180);
    expect(t.points[1].ts.getTime() - t.points[0].ts.getTime()).toBe(60_000);
  });

  it("throws when there are no track points", () => {
    expect(() => parseGpx("<gpx></gpx>")).toThrow();
  });

  it("synthesizes increasing timestamps when the GPX has none", () => {
    const noTime = `<gpx><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.001"/></trkseg></gpx>`;
    const t = parseGpx(noTime);
    expect(t.points).toHaveLength(2);
    expect(t.points[1].ts.getTime()).toBeGreaterThan(t.points[0].ts.getTime());
  });

  it("parses namespace-prefixed tags (e.g. Garmin Connect <gpx:trkpt>)", () => {
    const ns = `<gpx:gpx><gpx:trk><gpx:name>NS Route</gpx:name><gpx:trkseg>
      <gpx:trkpt lat="50.45" lon="30.52"><gpx:ele>180</gpx:ele><gpx:time>2026-01-01T00:00:00Z</gpx:time></gpx:trkpt>
      <gpx:trkpt lat="50.46" lon="30.53"><gpx:ele>190</gpx:ele><gpx:time>2026-01-01T00:01:00Z</gpx:time></gpx:trkpt>
    </gpx:trkseg></gpx:trk></gpx:gpx>`;
    const t = parseGpx(ns);
    expect(t.name).toBe("NS Route");
    expect(t.points).toHaveLength(2);
    expect(t.points[0].lat).toBe(50.45);
    expect(t.points[0].lng).toBe(30.52);
    expect(t.points[0].elevation).toBe(180);
    expect(t.points[1].ts.getTime() - t.points[0].ts.getTime()).toBe(60_000);
  });
});

describe("parseGeoJson", () => {
  it("parses a LineString Feature with coordinateProperties.times + 3rd-coord elevation", () => {
    const gj = {
      type: "Feature",
      properties: { name: "GJ", coordinateProperties: { times: ["2026-01-01T00:00:00Z", "2026-01-01T00:00:30Z"] } },
      geometry: { type: "LineString", coordinates: [[30.5, 50.4, 100], [30.51, 50.41, 110]] },
    };
    const t = parseGeoJson(gj);
    expect(t.name).toBe("GJ");
    expect(t.source).toBe("geojson");
    expect(t.points).toHaveLength(2);
    expect(t.points[0].elevation).toBe(100);
    expect(t.points[1].ts.getTime() - t.points[0].ts.getTime()).toBe(30_000);
  });

  it("throws on a non-line geometry", () => {
    expect(() => parseGeoJson({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} })).toThrow();
  });
});

describe("parseTrack", () => {
  it("sniffs GPX vs GeoJSON from the content", () => {
    const gpx = "<gpx><trkseg><trkpt lat='0' lon='0'/><trkpt lat='0' lon='0.001'/></trkseg></gpx>";
    expect(parseTrack(gpx).source).toBe("gpx");
    expect(parseTrack(JSON.stringify({ type: "LineString", coordinates: [[0, 0], [0.001, 0]] })).source).toBe("geojson");
  });
});
