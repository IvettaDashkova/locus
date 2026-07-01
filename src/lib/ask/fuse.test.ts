import { describe, it, expect } from "vitest";
import { fuseRrf } from "./fuse";

type R = { id: string; similarity?: number };

describe("fuseRrf", () => {
  it("ranks a row present in both lists above rows in only one", () => {
    const v: R[] = [{ id: "a", similarity: 0.8 }, { id: "b", similarity: 0.7 }];
    const k: R[] = [{ id: "b" }, { id: "c" }];
    const out = fuseRrf(v, k, 10);
    // `b` appears in both lists, so its summed RRF score beats the single-list `a` and `c`.
    expect(out[0].row.id).toBe("b");
    expect(out.map((r) => r.row.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("preserves vector similarity and zeroes keyword-only rows (grounding signal)", () => {
    const v: R[] = [{ id: "a", similarity: 0.82 }];
    const k: R[] = [{ id: "a" }, { id: "c" }];
    const out = fuseRrf(v, k, 10);
    const a = out.find((r) => r.row.id === "a")!;
    const c = out.find((r) => r.row.id === "c")!;
    expect(a.similarity).toBe(0.82); // carried from the vector list, not the keyword hit
    expect(c.similarity).toBe(0); // keyword-only → not "grounded"
  });

  it("drops a strong vector hit that fusion pushes out of top-k", () => {
    // `strong` has the best raw similarity but ranks low in both fused lists; with k=1 it must be
    // excluded — so the route's grounding gate never sees a high similarity for a chunk it won't send.
    const v: R[] = [{ id: "a", similarity: 0.3 }, { id: "strong", similarity: 0.99 }];
    const k: R[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = fuseRrf(v, k, 1);
    expect(out).toHaveLength(1);
    expect(out[0].row.id).toBe("a");
    expect(out.find((r) => r.row.id === "strong")).toBeUndefined();
    const topSimilarity = out.reduce((max, r) => Math.max(max, r.similarity), 0);
    expect(topSimilarity).toBe(0.3); // not 0.99 — the dropped strong hit can't pass the gate
  });

  it("respects k truncation", () => {
    const v: R[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const out = fuseRrf(v, [], 2);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.row.id)).toEqual(["a", "b"]);
  });
});
