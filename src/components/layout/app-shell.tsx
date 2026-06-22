import Link from "next/link";
import { MapPin } from "lucide-react";
import { ModuleNav } from "./module-nav";

/** Top bar + left module nav + main content region (where the map lives). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <MapPin className="size-5 text-primary" />
          Locus
        </Link>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          geospatial workspace
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-card/40 sm:block">
          <ModuleNav />
        </aside>
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
