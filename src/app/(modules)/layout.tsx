import { AppShell } from "@/components/layout/app-shell";
import { MapPanel } from "@/components/map/map-panel";

/**
 * Shared layout for all four modules: the map fills the main region persistently, with the active
 * module's content overlaid on top. Navigating between modules does not remount the map.
 */
export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <MapPanel className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 p-4">
        <div className="pointer-events-auto w-full max-w-md">{children}</div>
      </div>
    </AppShell>
  );
}
