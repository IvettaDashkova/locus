import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js base config. Only OAuth providers live here (no Node-only deps); the
 * Credentials provider — which hits the DB and `node:crypto` — is added in `auth.ts`.
 *
 * The app itself is public; signing in is only required to *save* data (enforced in the write API
 * routes), so there is no `authorized`/proxy gate.
 *
 * OAuth providers are opt-in: each is enabled only when its env vars are set.
 */
const oauthProviders: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(GitHub);
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(Google);
}

export const authConfig = {
  // Trust the host header. Auto-enabled on Vercel, but required for self-hosted / `next start`
  // (otherwise Auth.js throws UntrustedHost on every session check).
  trustHost: true,
  // JWT sessions (no DB adapter) — this is an access gate, not per-user data. No schema migration.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: oauthProviders,
  callbacks: {
    // Surface the user id (JWT `sub`) on the session so route handlers can scope data by owner.
    session({ session, token }) {
      if (token.sub && session.user) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
