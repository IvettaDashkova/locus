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
