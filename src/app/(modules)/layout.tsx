import { AppShell } from "@/components/layout/app-shell";
import { MapPanel } from "@/components/map/map-panel";
import { MapProvider } from "@/components/map/map-context";
import { AuthProvider } from "@/components/auth/auth-context";
import { CreditsProvider } from "@/components/credits/credits-context";
import { auth } from "@/auth";

/**
 * Shared layout for all four modules: a persistent map fills the main region; the active module's
 * content overlays it. The overlay is pointer-events-none so the map stays pannable — each module
 * opts its own UI back in with pointer-events-auto.
 *
 * The app is public; the session (if any) is read here and pushed to client components via
 * AuthProvider so they can require sign-in for saving.
 */
export default async function ModulesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user ? { name: session.user.name, email: session.user.email } : null;
  return (
    <AuthProvider user={user}>
      <CreditsProvider>
        <MapProvider>
          <AppShell userName={user?.name ?? user?.email ?? null}>
            <MapPanel className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-0">{children}</div>
          </AppShell>
        </MapProvider>
      </CreditsProvider>
    </AuthProvider>
  );
}
