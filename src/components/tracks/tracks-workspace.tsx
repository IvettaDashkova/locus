"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Route, Upload, X, Play, Pause, Footprints, Mountain, Bike, Car, Sailboat,
  Gauge, Clock, TrendingUp, Flag, Layers, Spline, Undo2, Check, Trash2, MousePointerClick,
  PanelRightOpen, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const FORM_WIDTH = 420; // left builder/detail panel
const RAIL_WIDTH = 320; // right list rail (matches Capture's w-80)

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
  const [listOpen, setListOpen] = useState(false); // mobile list sheet
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

  // Edit/delete state for the selected (owned) track.
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The left panel (builder or selected-track detail) is open whenever one of those is active.
  const formOpen = building || Boolean(selected);

  const playback = useTrackPlayback(selected?.points ?? []);

  const loadTracks = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/tracks", { cache: "no-store", signal });
      if (res.ok) setTracks((await res.json()).tracks ?? []);
    } catch {
      /* ignore (includes AbortError when navigating away) */
    }
  }, []);

  const selectTrack = useCallback(async (id: string) => {
    const res = await fetch(`/api/tracks/${id}`, { cache: "no-store" });
    if (res.ok) setSelected(await res.json());
  }, []);

  // Open a track from the list: leave the builder, load detail, close the mobile sheet.
  const openTrack = useCallback((id: string) => {
    setBuilding(false);
    setEditing(false);
    setListOpen(false);
    selectTrack(id);
  }, [selectTrack]);

  useEffect(() => {
    // Defer out of the effect body so the initial fetches don't set state synchronously on mount.
    // Abort both on unmount: against a slow DB these can be in-flight for seconds, and a stale request
    // left running holds one of the browser's ~6 per-host connections — enough of them starve the App
    // Router's navigation (RSC) fetches, which manifests as the dev "rendering" indicator hanging and
    // the next page never loading when clicking through the modules repeatedly.
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      loadTracks(ctrl.signal);
      fetch("/api/tracks/heatmap", { cache: "no-store", signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setHeatmap(d))
        .catch(() => {});
    }, 0);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [loadTracks]);

  useEffect(() => {
    setControlsCorner("bottom-left");
    return () => setControlsCorner("bottom-left");
  }, [setControlsCorner]);

  useEffect(() => {
    if (!map) return;
    // Reserve the persistent right list rail, and the left form panel while it's open.
    map.setPadding({
      top: 0,
      bottom: 0,
      left: formOpen && isWide ? FORM_WIDTH : 0,
      right: isWide ? RAIL_WIDTH : 0,
    });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map, isWide, formOpen]);

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

  // Rebuild the previewed route whenever the waypoints OR the activity change — only boats follow the
  // sea (a server call); every other activity is a straight line through the waypoints. The sequence
  // guard drops any in-flight boat fetch that lands after a newer change (e.g. Boat → Bike).
  useEffect(() => {
    if (!building) return;
    const mine = ++previewSeq.current;
    // Only Boat needs the (debounced) sea-route lookup; every other activity is immediate (delay 0),
    // so switching *away* from Boat clears the sea path at once instead of lingering for the debounce.
    const needsSeaRoute = routeActivity === "boat" && routeWaypoints.length >= 2;
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
    }, needsSeaRoute ? 250 : 0);
    return () => clearTimeout(id);
  }, [building, routeWaypoints, routeActivity]);

  const addWaypoint = useCallback((lng: number, lat: number, fly = false) => {
    setRouteWaypoints((w) => [...w, [lng, lat]]);
    if (fly && map) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
  }, [map]);

  function startBuild() {
    setSelected(null);
    setEditing(false);
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

  function startEdit() {
    if (!selected) return;
    setEditName(selected.track.name);
    setEditActivity((selected.track.activity as Activity) ?? null);
    setEditDescription(selected.track.description ?? "");
    setError(null);
    setEditing(true);
  }
  async function saveEdit() {
    if (!selected || savingEdit || !editName.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/tracks/${selected.track.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), activity: editActivity, description: editDescription.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setEditing(false);
      await loadTracks();
      await selectTrack(selected.track.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingEdit(false);
    }
  }
  async function deleteTrack() {
    if (!selected || deleting) return;
    if (!window.confirm(t("tracks.deleteConfirm"))) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tracks/${selected.track.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Delete failed");
      }
      playback.pause();
      setEditing(false);
      setSelected(null);
      await loadTracks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  const m = selected?.track.metrics ?? null;

  // The track list — reused by the persistent desktop rail and the mobile sheet.
  const trackList = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("nav.tracks")}</h2>
        <Badge variant="outline">{tracks.length}</Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-3">
          {tracks.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => openTrack(tr.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                selected?.track.id === tr.id && "border-primary bg-primary/5",
              )}
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
          {!tracks.length ? <p className="px-1 text-sm text-muted-foreground">{t("tracks.empty")}</p> : null}
        </div>
      </ScrollArea>
    </div>
  );

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

      {building ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 md:left-[calc(50%+50px)]">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur">
            <MousePointerClick className="size-4 text-primary" />
            {t("tracks.build.mapHint", { n: String(routeWaypoints.length) })}
          </span>
        </div>
      ) : null}

      {/* Left action buttons — shown when the left panel is closed (matches Capture's "+ New form"). */}
      {!formOpen ? (
        <div className="pointer-events-auto absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2 shadow-lg">
              <Upload className="size-4" />
              {importing ? t("tracks.importing") : t("tracks.import")}
            </Button>
            <Button onClick={startBuild} variant="secondary" className="gap-2 shadow-lg">
              <Spline className="size-4" />
              {t("tracks.build")}
            </Button>
            <Button
              onClick={() => setShowHeatmap((v) => !v)}
              variant={showHeatmap ? "secondary" : "outline"}
              className="gap-2 shadow-lg"
            >
              <Layers className="size-4" />
              {t("tracks.heatmap")}
            </Button>
          </div>
          {!isLoggedIn ? <div className="max-w-xs"><SignInHint callbackUrl="/tracks" /></div> : null}
          {error ? <p className="rounded-md border border-destructive/40 bg-card/95 px-3 py-2 text-sm text-destructive shadow-lg backdrop-blur">⚠ {error}</p> : null}
        </div>
      ) : null}

      {/* Mobile: open the track list */}
      <div className="pointer-events-auto absolute right-4 top-4 md:hidden">
        <Button variant="secondary" onClick={() => setListOpen(true)} className="gap-2 shadow-lg">
          <PanelRightOpen className="size-4" />
          {t("nav.tracks")}
          <Badge variant="outline">{tracks.length}</Badge>
        </Button>
      </div>

      {/* Left panel: route builder OR selected-track detail */}
      <aside
        className={cn(
          "absolute left-0 top-0 h-full w-full border-r bg-card/95 shadow-xl backdrop-blur transition-transform duration-200 md:w-[420px]",
          formOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!formOpen}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="truncate text-sm font-semibold">
              {building ? t("tracks.build.title") : (selected?.track.name ?? t("nav.tracks"))}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setEditing(false);
                if (building) cancelBuild();
                else {
                  setSelected(null);
                  playback.pause();
                }
              }}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {building ? (
              <div className="space-y-4 p-4">
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
            ) : selected && editing ? (
              <div className="space-y-4 p-4">
                <h3 className="text-base font-semibold">{t("tracks.editTitle")}</h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("tracks.build.name")}</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                        onClick={() => setEditActivity(a)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                          editActivity === a ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent",
                        )}
                      >
                        <ActivityIcon activity={a} className="size-3.5" />
                        {t(`tracks.activity.${a}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("tracks.descriptionLabel")}</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>

                {error ? <p className="text-sm text-destructive">⚠ {error}</p> : null}

                <div className="flex items-center gap-2">
                  <Button onClick={saveEdit} disabled={!editName.trim() || savingEdit} size="sm" className="gap-2">
                    <Check className="size-4" />
                    {savingEdit ? t("tracks.build.saving") : t("tracks.build.save")}
                  </Button>
                  <Button onClick={() => setEditing(false)} variant="outline" size="sm">
                    {t("tracks.build.cancel")}
                  </Button>
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ActivityIcon activity={selected.track.activity} className="size-5 shrink-0 text-primary" />
                    <h3 className="truncate text-base font-semibold">{selected.track.name}</h3>
                  </div>
                  {selected.track.canEdit ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={startEdit} aria-label={t("tracks.edit")} title={t("tracks.edit")}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={deleteTrack} disabled={deleting} aria-label={t("tracks.delete")} title={t("tracks.delete")}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {selected.track.description ? (
                  <p className="text-sm text-muted-foreground">{selected.track.description}</p>
                ) : null}

                {error ? <p className="text-sm text-destructive">⚠ {error}</p> : null}

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
            ) : null}
          </ScrollArea>
        </div>
      </aside>

      {/* Right rail: the track list, always visible on desktop (like the Capture submissions list) */}
      <aside className="pointer-events-auto absolute right-0 top-0 hidden h-full w-80 border-l bg-card/95 shadow-xl backdrop-blur md:block">
        {trackList}
      </aside>

      {/* Mobile: track list in a sheet */}
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="right" className="w-80 max-w-[88vw] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.tracks")}</SheetTitle>
          </SheetHeader>
          {trackList}
        </SheetContent>
      </Sheet>

      {selected ? (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-full border bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur md:left-[calc(50%+50px)]">
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
