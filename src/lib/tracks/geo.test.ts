import { describe, it, expect } from "vitest";
import { haversineM, centroid } from "./geo";

describe("haversineM", () => {
  it("≈ 111.19 m for 0.001° of longitude at the equator", () => {
    const d = haversineM([0, 0], [0.001, 0]);
    expect(d).toBeGreaterThan(111);
    expect(d).toBeLessThan(111.4);
  });

  it("is 0 for identical points", () => {
    expect(haversineM([10, 50], [10, 50])).toBe(0);
  });

  it("is symmetric", () => {
    expect(haversineM([0, 0], [1, 1])).toBeCloseTo(haversineM([1, 1], [0, 0]), 6);
  });
});

describe("centroid", () => {
  it("averages the points", () => {
    expect(centroid([[0, 0], [2, 2], [4, 4]])).toEqual([2, 2]);
  });

  it("returns the point itself for a single point", () => {
    expect(centroid([[3, 7]])).toEqual([3, 7]);
  });
});
