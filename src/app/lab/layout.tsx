import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/auth/auth-context";
import { CreditsProvider } from "@/components/credits/credits-context";
import { auth } from "@/auth";

/**
 * The Navigation Lab lives outside the `(modules)` group on purpose: its demos are self-contained
 * offline SVGs and need no map. Keeping the shared AppShell (nav, credits, theme) gives a consistent
 * header, but skipping MapProvider/MapPanel means MapLibre never loads here — lighter for users and
 * honest Lighthouse/crawler scores (no WebGL boot, no map bundle).
 */
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user ? { name: session.user.name, email: session.user.email } : null;
  return (
    <AuthProvider user={user}>
      <CreditsProvider>
        <AppShell userName={user?.name ?? user?.email ?? null}>{children}</AppShell>
      </CreditsProvider>
    </AuthProvider>
  );
}
