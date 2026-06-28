import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config shared by the proxy gate and the full server instance.
 *
 * Only OAuth providers live here — they have no Node-only dependencies, so this file can run in the
 * proxy. The Credentials provider (which needs `node:crypto`) is added in `auth.ts`, which runs in
 * the Node route handler only. See https://authjs.dev/getting-started/migrating-to-v5#edge-compatibility.
 *
 * OAuth providers are opt-in: each is enabled only when its env vars are set, so the app works
 * out-of-the-box with the demo password and gains "Sign in with GitHub/Google" once configured.
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
    /**
     * Runs in the proxy on every matched request. Returning false sends the user to `/login`;
     * the login page itself stays public. This is the single gate for the whole app.
     */
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      if (pathname === "/login") return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
