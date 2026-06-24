import { AppShell } from "@/components/layout/app-shell";
import { MapPanel } from "@/components/map/map-panel";
import { MapProvider } from "@/components/map/map-context";

/**
 * Shared layout for all four modules: a persistent map fills the main region; the active module's
 * content overlays it. The overlay is pointer-events-none so the map stays pannable — each module
 * opts its own UI back in with pointer-events-auto.
 */
export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapProvider>
      <AppShell>
        <MapPanel className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0">{children}</div>
      </AppShell>
    </MapProvider>
  );
}
