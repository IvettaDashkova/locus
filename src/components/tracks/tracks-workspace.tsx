"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Route, Upload, X, Play, Pause, ChevronLeft, Footprints, Mountain, Bike, Car, Sailboat,
  Gauge, Clock, TrendingUp, Flag, Layers, Spline, Undo2, Check, Trash2, MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { useMapContext } from "@/components/map/map-context";
import { useAuth } from "@/components/auth/auth-context";
import { SignInHint } from "@/components/auth/sign-in-hint";
import type { TrackSummary, TrackDetail } from "@/lib/tracks/queries";
import { fmtKm, fmtKmh, fmtM, fmtDuration } from "@/lib/tracks/format";
import { ACTIVITIES, type Activity } from "@/lib/tracks/presets";
import { useTrackPlayback } from "@/lib/tracks/use-playback";
import { TracksLayer } from "./tracks-layer";
import { RouteBuilderLayer } from "./route-builder-layer";
import { PlaceSearch } from "./place-search";
import { TrackCharts } from "./track-charts";
import { TrackExplain } from "./track-explain";

const PANEL_WIDTH = 420;

function ActivityIcon({ activity, className }: { activity: string | null; className?: string }) {
  switch (activity) {
    case "walk":
    case "run":
      return <Footprints className={className} />;
    case "hike":
      return <Mountain className={className} />;
    case "cycle":
      return <Bike className={className} />;
    case "drive":
      return <Car className={className} />;
    case "boat":
      return <Sailboat className={className} />;
    default:
      return <Route className={className} />;
  }
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function TracksWorkspace() {
  const { t } = useI18n();
  const { map, setControlsCorner } = useMapContext();
  const { isLoggedIn } = useAuth();
  const isWide = useMediaQuery("(min-width: 768px)");
  const fileRef = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [selected, setSelected] = useState<TrackDetail | null>(null);
  const [heatmap, setHeatmap] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Route builder state.
  const [building, setBuilding] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeActivity, setRouteActivity] = useState<Activity>("walk");
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);
  const [routedPath, setRoutedPath] = useState<[number, number][] | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const previewSeq = useRef(0);

  const playback = useTrackPlayback(selected?.points ?? []);

  const loadTracks = useCallback(async () => {
    const res = await fetch("/api/tracks", { cache: "no-store" });
    if (res.ok) setTracks((await res.json()).tracks ?? []);
  }, []);

  const selectTrack = useCallback(async (id: string) => {
    const res = await fetch(`/api/tracks/${id}`, { cache: "no-store" });
    if (res.ok) setSelected(await res.json());
  }, []);

  useEffect(() => {
    // Defer out of the effect body so the initial fetches don't set state synchronously on mount.
    const id = setTimeout(() => {
      loadTracks();
      fetch("/api/tracks/heatmap", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setHeatmap(d))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(id);
  }, [loadTracks]);

  useEffect(() => {
    setControlsCorner("bottom-right");
    return () => setControlsCorner("bottom-left");
  }, [setControlsCorner]);

  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 0, bottom: 0, right: 0, left: open && isWide ? PANEL_WIDTH : 0 });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map, isWide, open]);

  async function onFile(file: File) {
    if (!isLoggedIn) return; // SignInHint is shown; importing requires an account
    setImporting(true);
    setError(null);
    try {
      const content = await file.text();
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, filename: file.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      await loadTracks();
      await selectTrack(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  // Rebuild the previewed route whenever the waypoints OR the activity change — boats follow the sea,
  // so switching to/from Boat re-routes the drawn line. Debounced; non-boat is a straight line (no call).
  useEffect(() => {
    if (!building) return;
    const mine = ++previewSeq.current;
    const id = setTimeout(async () => {
      if (routeWaypoints.length < 2) {
        setRoutedPath(null);
        return;
      }
      if (routeActivity !== "boat") {
        setRoutedPath(routeWaypoints);
        return;
      }
      try {
        const res = await fetch("/api/tracks/route-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ activity: routeActivity, waypoints: routeWaypoints }),
        });
        const json = await res.json();
        if (mine === previewSeq.current) setRoutedPath(json.path ?? routeWaypoints);
      } catch {
        if (mine === previewSeq.current) setRoutedPath(routeWaypoints);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [building, routeWaypoints, routeActivity]);

  const addWaypoint = useCallback((lng: number, lat: number, fly = false) => {
    setRouteWaypoints((w) => [...w, [lng, lat]]);
    if (fly && map) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
  }, [map]);

  function startBuild() {
    setSelected(null);
    setError(null);
    setRouteName("");
    setRouteActivity("walk");
    setRouteWaypoints([]);
    setBuilding(true);
  }
  function cancelBuild() {
    setBuilding(false);
    setRouteWaypoints([]);
    setRoutedPath(null);
  }
  async function saveRoute() {
    if (routeWaypoints.length < 2 || savingRoute) return;
    if (!isLoggedIn) return; // SignInHint is shown; saving requires an account
    setSavingRoute(true);
    setError(null);
    try {
      const res = await fetch("/api/tracks/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: routeName, activity: routeActivity, waypoints: routeWaypoints }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Build failed");
      setBuilding(false);
      setRouteWaypoints([]);
      await loadTracks();
      await selectTrack(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingRoute(false);
    }
  }

  const m = selected?.track.metrics ?? null;

  return (
    <>
      <TracksLayer
        tracks={tracks}
        selected={selected}
        heatmap={heatmap}
        showHeatmap={showHeatmap}
        playhead={selected ? playback.position : null}
      />
      <RouteBuilderLayer active={building} waypoints={routeWaypoints} routedPath={routedPath} onAdd={(lng, lat) => addWaypoint(lng, lat)} />

      {building ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 md:left-[calc(50%+210px)]">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur">
            <MousePointerClick className="size-4 text-primary" />
            {t("tracks.build.mapHint", { n: String(routeWaypoints.length) })}
          </span>
        </div>
      ) : null}

      {!open ? (
        <div className="pointer-events-auto absolute left-4 top-4">
          <Button onClick={() => setOpen(true)} className="gap-2 shadow-lg">
            <Route className="size-4" />
            {t("nav.tracks")}
          </Button>
        </div>
      ) : null}

      <aside
        className={cn(
          "absolute left-0 top-0 h-full w-full border-r bg-card/95 shadow-xl backdrop-blur transition-transform duration-200 md:w-[420px]",
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("nav.tracks")}</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {building ? (
              <div className="space-y-4 p-4">
                <button
                  type="button"
                  onClick={cancelBuild}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  {t("tracks.back")}
                </button>

                <div className="flex items-center gap-2">
                  <Spline className="size-5 text-primary" />
                  <h3 className="text-base font-semibold">{t("tracks.build.title")}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t("tracks.build.hint")}</p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("tracks.build.name")}</label>
                  <input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder={t("tracks.build.namePlaceholder")}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("tracks.build.activity")}</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ACTIVITIES.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setRouteActivity(a)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                          routeActivity === a ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                        )}
                      >
                        <ActivityIcon activity={a} className="size-3.5" />
                        {t(`tracks.activity.${a}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("tracks.build.add")}</label>
                  <PlaceSearch onPick={(lng, lat) => addWaypoint(lng, lat, true)} />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t("tracks.build.points", { n: String(routeWaypoints.length) })}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRouteWaypoints((w) => w.slice(0, -1))}
                      disabled={!routeWaypoints.length}
                      aria-label={t("tracks.build.undo")}
                    >
                      <Undo2 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRouteWaypoints([])}
                      disabled={!routeWaypoints.length}
                      aria-label={t("tracks.build.clear")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {error ? <p className="text-sm text-destructive">⚠ {error}</p> : null}
                {!isLoggedIn ? <SignInHint callbackUrl="/tracks" /> : null}

                <div className="flex items-center gap-2">
                  <Button onClick={saveRoute} disabled={routeWaypoints.length < 2 || savingRoute} size="sm" className="gap-2">
                    <Check className="size-4" />
                    {savingRoute ? t("tracks.build.saving") : t("tracks.build.save")}
                  </Button>
                  <Button onClick={cancelBuild} variant="outline" size="sm">
                    {t("tracks.build.cancel")}
                  </Button>
                </div>
              </div>
            ) : !selected ? (
              <div className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">{t("tracks.intro")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => fileRef.current?.click()} disabled={importing} size="sm" className="gap-2">
                    <Upload className="size-4" />
                    {importing ? t("tracks.importing") : t("tracks.import")}
                  </Button>
                  <Button onClick={startBuild} variant="outline" size="sm" className="gap-2">
                    <Spline className="size-4" />
                    {t("tracks.build")}
                  </Button>
                  <Button
                    onClick={() => setShowHeatmap((v) => !v)}
                    variant={showHeatmap ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2"
                  >
                    <Layers className="size-4" />
                    {t("tracks.heatmap")}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".gpx,.geojson,.json,application/gpx+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {!isLoggedIn ? <SignInHint callbackUrl="/tracks" /> : null}
                {error ? <p className="text-sm text-destructive">⚠ {error}</p> : null}

                <div className="flex flex-col gap-2 pt-1">
                  {tracks.map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => selectTrack(tr.id)}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                    >
                      <ActivityIcon activity={tr.activity} className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{tr.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tr.metrics ? `${fmtKm(tr.metrics.distanceM)} · ${fmtDuration(tr.metrics.durationS)} · ${tr.metrics.stopCount} stops` : "—"}
                        </div>
                      </div>
                    </button>
                  ))}
                  {!tracks.length ? <p className="text-sm text-muted-foreground">{t("tracks.empty")}</p> : null}
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    playback.pause();
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  {t("tracks.back")}
                </button>

                <div className="flex items-center gap-2">
                  <ActivityIcon activity={selected.track.activity} className="size-5 text-primary" />
                  <h3 className="text-base font-semibold">{selected.track.name}</h3>
                </div>
                {selected.track.description ? (
                  <p className="text-sm text-muted-foreground">{selected.track.description}</p>
                ) : null}

                {m ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat icon={<Route className="size-3.5" />} label={t("tracks.metric.distance")} value={fmtKm(m.distanceM)} />
                    <Stat icon={<Clock className="size-3.5" />} label={t("tracks.metric.movingTime")} value={fmtDuration(m.movingTimeS)} />
                    <Stat icon={<Gauge className="size-3.5" />} label={t("tracks.metric.avgSpeed")} value={fmtKmh(m.avgSpeedMps)} />
                    <Stat icon={<Gauge className="size-3.5" />} label={t("tracks.metric.maxSpeed")} value={fmtKmh(m.maxSpeedMps)} />
                    <Stat icon={<TrendingUp className="size-3.5" />} label={t("tracks.metric.ascent")} value={fmtM(m.elevationGainM)} />
                    <Stat icon={<Flag className="size-3.5" />} label={t("tracks.metric.stops")} value={`${m.stopCount}`} />
                  </div>
                ) : null}

                <TrackCharts points={selected.points} segments={selected.segments} pointIndex={playback.pointIndex} />

                <TrackExplain trackId={selected.track.id} />
              </div>
            )}
          </ScrollArea>
        </div>
      </aside>

      {selected ? (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-full border bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur md:left-[calc(50%+210px)]">
          <Button onClick={playback.toggle} size="icon" className="size-9 shrink-0 rounded-full" aria-label={playback.playing ? "Pause" : "Play"}>
            {playback.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={playback.progress}
            onChange={(e) => playback.seek(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-primary"
            aria-label={t("tracks.scrubber")}
          />
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {playback.atTime
              ? playback.atTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "--:--"}
          </span>
        </div>
      ) : null}
    </>
  );
}
