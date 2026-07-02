import { describe, expect, it } from "vitest";
import { simplify } from "./simplify";
import type { LngLat } from "./types";

describe("simplify (Ramer–Douglas–Peucker)", () => {
  it("keeps endpoints and collapses collinear points", () => {
    const line: LngLat[] = [[0, 0], [0.001, 0], [0.002, 0], [0.003, 0]];
    const out = simplify(line, 1);
    expect(out).toEqual([[0, 0], [0.003, 0]]);
  });

  it("preserves a sharp corner above tolerance", () => {
    const corner: LngLat[] = [[0, 0], [0.001, 0.001], [0.002, 0]];
    const out = simplify(corner, 1);
    expect(out).toHaveLength(3); // the apex is far off the baseline, so it survives
  });

  it("removes a corner that falls within tolerance", () => {
    const nearlyStraight: LngLat[] = [[0, 0], [0.5, 0.0000001], [1, 0]];
    const out = simplify(nearlyStraight, 100);
    expect(out).toEqual([[0, 0], [1, 0]]);
  });

  it("never returns more points than it was given, and monotonically shrinks with tolerance", () => {
    const zig: LngLat[] = Array.from({ length: 200 }, (_, i) => [
      i * 0.001,
      (i % 2 === 0 ? 1 : -1) * 0.0002,
    ]);
    const loose = simplify(zig, 50);
    const tight = simplify(zig, 5);
    expect(loose.length).toBeLessThanOrEqual(zig.length);
    expect(loose.length).toBeLessThanOrEqual(tight.length);
    expect(loose[0]).toEqual(zig[0]);
    expect(loose.at(-1)).toEqual(zig.at(-1));
  });

  it("is a copy for trivial inputs (≤ 2 points)", () => {
    const pts: LngLat[] = [[1, 2], [3, 4]];
    const out = simplify(pts, 10);
    expect(out).toEqual(pts);
    expect(out[0]).not.toBe(pts[0]);
  });
});
