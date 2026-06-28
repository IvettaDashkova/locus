import { describe, it, expect } from "vitest";
import { seaRoute, seaRouteSegment } from "./sea-route";

describe("seaRoute (marine routing)", () => {
  it("routes around land — Lisbon→Barcelona dips south past Gibraltar, not straight across Spain", () => {
    const path = seaRoute([[-9.6, 38.6], [2.6, 41.2]]);
    expect(path.length).toBeGreaterThan(2);
    const minLat = Math.min(...path.map((p) => p[1]));
    expect(minLat).toBeLessThan(37); // went south around Iberia
  });

  it("falls back to a straight hop for two very close points", () => {
    const a: [number, number] = [2.0, 41.0];
    const b: [number, number] = [2.001, 41.001];
    expect(seaRouteSegment(a, b)).toEqual([a, b]);
  });
});
