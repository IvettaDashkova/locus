"use client";

import dynamic from "next/dynamic";

// Load the MapLibre shell client-side only (it touches `window`).
const MapShell = dynamic(() => import("./map-shell").then((m) => m.MapShell), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapPanel({ className }: { className?: string }) {
  return <MapShell className={className} />;
}
