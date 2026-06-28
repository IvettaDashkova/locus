"use client";

import { useRef, useState } from "react";
import { Search, MapPin, Crosshair, Loader2 } from "lucide-react";
import type { GeocodeResult } from "@/app/api/geocode/route";
import { useI18n } from "@/lib/i18n/provider";

/** Parse "lat, lng" / "lat lng" into a result, swapping if the pair only makes sense the other way. */
function parseCoords(q: string): GeocodeResult | null {
  const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  let lat = Number(m[1]);
  let lng = Number(m[2]);
  const inRange = (la: number, ln: number) => Math.abs(la) <= 90 && Math.abs(ln) <= 180;
  if (!inRange(lat, lng) && inRange(lng, lat)) [lat, lng] = [lng, lat];
  if (!inRange(lat, lng)) return null;
  return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
}

/**
 * Typeahead for adding a waypoint by place name or coordinates. Place lookups hit /api/geocode
 * (Photon) debounced; a "lat, lng" input is offered directly as a pin. Picking calls `onPick`.
 */
export function PlaceSearch({ onPick }: { onPick: (lng: number, lat: number, label: string) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const coord = parseCoords(query);

  function onChange(v: string) {
    setQuery(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2 || parseCoords(v)) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(v.trim())}`);
        const json = await res.json();
        if (mine === seq.current) setResults(json.results ?? []);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 300);
  }

  function pick(r: GeocodeResult) {
    onPick(r.lng, r.lat, r.label);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const show = open && (loading || coord != null || results.length > 0);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t("tracks.build.search")}
          className="h-9 flex-1 bg-transparent text-sm outline-none"
        />
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>

      {show ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover py-1 shadow-lg">
          {coord ? (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(coord)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <Crosshair className="size-4 shrink-0 text-primary" />
                <span className="truncate">{t("tracks.build.useCoords", { coords: coord.label })}</span>
              </button>
            </li>
          ) : null}
          {results.map((r, i) => (
            <li key={`${r.lng},${r.lat},${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{r.label}</span>
              </button>
            </li>
          ))}
          {!loading && !coord && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("tracks.build.noResults")}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
