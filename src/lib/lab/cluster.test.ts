import { describe, expect, it } from "vitest";
import { gridCluster } from "./cluster";
import type { LngLat } from "./types";

describe("gridCluster", () => {
  it("collapses a tight crowd into one counted cluster at its centroid", () => {
    const crowd: LngLat[] = [[10.01, 20.01], [10.02, 20.02], [10.03, 20.03]];
    const out = gridCluster(crowd, 1);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
    expect(out[0].lng).toBeCloseTo(10.02, 6);
    expect(out[0].lat).toBeCloseTo(20.02, 6);
  });

  it("keeps points in different cells separate", () => {
    const spread: LngLat[] = [[0.5, 0.5], [5.5, 5.5], [-3.5, 2.5]];
    const out = gridCluster(spread, 1);
    expect(out).toHaveLength(3);
    out.forEach((c) => expect(c.count).toBe(1));
  });

  it("conserves the total count across all clusters", () => {
    const pts: LngLat[] = Array.from({ length: 500 }, (_, i) => [
      (i % 50) * 0.1,
      Math.floor(i / 50) * 0.1,
    ]);
    const out = gridCluster(pts, 1);
    expect(out.reduce((s, c) => s + c.count, 0)).toBe(500);
    expect(out.length).toBeLessThan(pts.length);
  });

  it("handles cellDeg ≤ 0 by returning every point as its own cluster", () => {
    const pts: LngLat[] = [[1, 1], [2, 2]];
    expect(gridCluster(pts, 0)).toHaveLength(2);
  });
});
