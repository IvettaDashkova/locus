import { describe, it, expect } from "vitest";
import { fmtKm, fmtKmh, fmtM, fmtDuration } from "./format";

describe("track formatters", () => {
  it("fmtKm", () => {
    expect(fmtKm(1234)).toBe("1.23 km");
    expect(fmtKm(0)).toBe("0.00 km");
  });

  it("fmtKmh converts m/s to km/h", () => {
    expect(fmtKmh(10)).toBe("36.0 km/h");
  });

  it("fmtM rounds to whole metres", () => {
    expect(fmtM(12.4)).toBe("12 m");
  });

  it("fmtDuration picks the right unit", () => {
    expect(fmtDuration(20)).toBe("20 s");
    expect(fmtDuration(600)).toBe("10 min");
    expect(fmtDuration(3661)).toBe("1 h 1 min");
  });
});
