/**
 * Deterministic pseudo-randomness for the lab demos. Real GPS jitter is random, but a portfolio demo
 * must look identical on every render and in tests — so we seed a small, fast PRNG (mulberry32) and
 * derive Gaussian noise from it via Box–Muller. Nothing here touches Math.random().
 */

/** mulberry32: a compact, well-distributed 32-bit PRNG. Returns a function yielding [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard-normal sample (mean 0, sd 1) from a uniform generator, via Box–Muller. */
export function gaussian(rand: () => number): number {
  // Guard the log against an exact 0 from the uniform stream.
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
