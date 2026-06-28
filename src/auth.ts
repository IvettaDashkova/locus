import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { authConfig } from "./auth.config";

/** The shared access password. Set APP_ACCESS_PASSWORD in production; falls back to a dev default. */
const ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD ?? "locus";

/** Constant-time string compare so the gate doesn't leak the password length/prefix via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Full Auth.js instance used by the route handler and server code. It extends the edge-safe
 * `authConfig` with a Credentials provider — a single shared password that gates the demo without
 * requiring any external OAuth setup. OAuth providers (if configured) come from `authConfig`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Access password",
      credentials: { password: { label: "Password", type: "password" } },
      authorize(credentials) {
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (password && safeEqual(password, ACCESS_PASSWORD)) {
          return { id: "demo", name: "Demo user" };
        }
        return null;
      },
    }),
  ],
});
