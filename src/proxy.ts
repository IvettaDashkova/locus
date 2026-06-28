import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authConfig } from "./auth.config";

/**
 * App-wide auth gate. In Next.js 16 this file is `proxy.ts` (formerly `middleware.ts`). We run a
 * lightweight Auth.js instance built from the edge-safe `authConfig` — it decodes the JWT session
 * cookie and the `authorized` callback redirects logged-out users to `/login`.
 *
 * Next requires a literal `proxy` (or default) function export, so we wrap Auth.js's `auth` handler
 * rather than re-exporting the destructured binding directly.
 *
 * The matcher skips `/api/auth/*` (the sign-in endpoints must stay reachable), Next internals, and
 * static assets; everything else — pages and the data APIs — requires a session.
 */
const { auth } = NextAuth(authConfig);
const handler = auth as unknown as (req: NextRequest, ev: unknown) => Response | Promise<Response>;

export default function proxy(request: NextRequest, event: unknown) {
  return handler(request, event);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
