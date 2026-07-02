import { describe, expect, it } from "vitest";
import { naivePlanarM, planarErrorFraction, haversineM } from "./distance";
import type { LngLat } from "./types";

describe("naive vs great-circle distance", () => {
  it("agrees closely at the equator (cos(0) = 1)", () => {
    const a: LngLat = [0, 0];
    const b: LngLat = [1, 0]; // one degree of longitude, on the equator
    expect(Math.abs(planarErrorFraction(a, b))).toBeLessThan(0.005);
  });

  it("overestimates east–west distance at high latitude", () => {
    const a: LngLat = [30, 60];
    const b: LngLat = [31, 60]; // one degree of longitude at 60°N — truly ~half the equatorial span
    const err = planarErrorFraction(a, b);
    expect(err).toBeGreaterThan(0.5); // naive is ~2x too long here
  });

  it("error grows monotonically with latitude for an east–west step", () => {
    const errAt = (lat: number) => planarErrorFraction([0, lat], [1, lat]);
    expect(errAt(20)).toBeLessThan(errAt(45));
    expect(errAt(45)).toBeLessThan(errAt(70));
  });

  it("has near-zero error for a purely north–south step at any latitude", () => {
    const err = planarErrorFraction([0, 50], [0, 51]);
    expect(Math.abs(err)).toBeLessThan(0.01);
  });

  it("naivePlanarM and haversineM are both zero for identical points", () => {
    const p: LngLat = [12.34, 56.78];
    expect(naivePlanarM(p, p)).toBe(0);
    expect(haversineM(p, p)).toBe(0);
  });
});
