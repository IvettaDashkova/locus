"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrackPointRow } from "./queries";

export type Playback = {
  progress: number; // 0..1 over the track's real elapsed time
  playing: boolean;
  position: [number, number] | null; // interpolated [lng, lat] at `progress`
  pointIndex: number; // nearest fix index, for chart cursors
  atTime: Date | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (p: number) => void;
};

/**
 * Time-based playback over a track. Mapping progress to *real elapsed time* (not point index) means
 * the marker naturally lingers where the traveller dwelled — stops read as pauses, fast legs read as
 * fast — which is what makes the replay legible. The whole track plays in ~`playSeconds` wall-clock.
 */
export function useTrackPlayback(points: TrackPointRow[], playSeconds = 24): Playback {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const progressRef = useRef(0);

  const times = useMemo(() => points.map((p) => new Date(p.ts).getTime()), [points]);
  const t0 = times[0] ?? 0;
  const t1 = times[times.length - 1] ?? 0;
  const span = Math.max(1, t1 - t0);

  // Mirror progress into a ref so the animation loop reads the latest value without re-subscribing.
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Advance progress by real frame delta while playing. We avoid Date.now() drift by using the rAF
  // timestamp the browser hands us; state is only set inside the frame callback (never synchronously).
  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000;
        const next = progressRef.current + dt / playSeconds;
        if (next >= 1) {
          progressRef.current = 1;
          setProgress(1);
          setPlaying(false); // reached the end
          return;
        }
        progressRef.current = next;
        setProgress(next);
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, playSeconds]);

  const play = useCallback(() => {
    setProgress((p) => (p >= 1 ? 0 : p)); // restart if finished
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? setPlaying(false) : play()), [playing, play]);
  const seek = useCallback((p: number) => setProgress(Math.min(1, Math.max(0, p))), []);

  // Interpolate position at the target time.
  const targetMs = t0 + progress * span;
  let position: [number, number] | null = null;
  let pointIndex = 0;
  if (points.length) {
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < targetMs) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const a = points[i - 1];
    const b = points[i];
    const segSpan = times[i] - times[i - 1] || 1;
    const f = Math.min(1, Math.max(0, (targetMs - times[i - 1]) / segSpan));
    position = [a.lng + (b.lng - a.lng) * f, a.lat + (b.lat - a.lat) * f];
    pointIndex = f < 0.5 ? i - 1 : i;
  }

  return {
    progress,
    playing,
    position,
    pointIndex,
    atTime: points.length ? new Date(targetMs) : null,
    play,
    pause,
    toggle,
    seek,
  };
}
