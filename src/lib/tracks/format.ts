/** Shared human formatting for track metrics (client + UI). */

export const fmtKm = (m: number) => `${(m / 1000).toFixed(2)} km`;
export const fmtKmh = (mps: number) => `${(mps * 3.6).toFixed(1)} km/h`;
export const fmtM = (m: number) => `${Math.round(m)} m`;

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${Math.round(s)} s`;
}
