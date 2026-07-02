import { describe, expect, it } from "vitest";
import { worldToXY, xyToWorld, project, unproject, type Viewport } from "./projection";
import type { LngLat } from "./types";

describe("equirectangular worldToXY", () => {
  it("maps the corners of the globe to the corners of the box", () => {
    expect(worldToXY([-180, 90], 360, 180)).toEqual([0, 0]);
    expect(worldToXY([180, -90], 360, 180)).toEqual([360, 180]);
    expect(worldToXY([0, 0], 360, 180)).toEqual([180, 90]);
  });

  it("round-trips through xyToWorld", () => {
    const p: LngLat = [30.52, 50.45]; // Kyiv
    const [x, y] = worldToXY(p, 800, 400);
    const back = xyToWorld([x, y], 800, 400);
    expect(back[0]).toBeCloseTo(p[0], 9);
    expect(back[1]).toBeCloseTo(p[1], 9);
  });
});

describe("Web Mercator viewport", () => {
  const vp: Viewport = { center: [30.52, 50.45], zoom: 6, width: 640, height: 480 };

  it("projects the viewport centre to the middle of the box", () => {
    const [x, y] = project(vp.center, vp);
    expect(x).toBeCloseTo(320, 6);
    expect(y).toBeCloseTo(240, 6);
  });

  it("round-trips project → unproject for arbitrary points", () => {
    const p: LngLat = [31.9, 49.1];
    const back = unproject(project(p, vp), vp);
    expect(back[0]).toBeCloseTo(p[0], 6);
    expect(back[1]).toBeCloseTo(p[1], 6);
  });

  it("puts more-easterly points to the right and more-northerly points up", () => {
    const east = project([32, 50.45], vp);
    const north = project([30.52, 52], vp);
    expect(east[0]).toBeGreaterThan(320);
    expect(north[1]).toBeLessThan(240);
  });
});
