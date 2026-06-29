import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * For write endpoints: returns a 401 response if there's no session, else null. The app is public
 * to read; only saving data requires an authorized user.
 *
 *   const denied = await requireAuth();
 *   if (denied) return denied;
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  return null;
}

/**
 * Like `requireAuth`, but returns the signed-in user's id (for owner-scoped writes) or a 401.
 *
 *   const who = await requireUser();
 *   if (who instanceof NextResponse) return who;
 *   who.id // the owner
 */
export async function requireUser(): Promise<{ id: string } | NextResponse> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  return { id };
}

/** The current user's id, or null if logged out. For read endpoints that compute `canEdit`. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
