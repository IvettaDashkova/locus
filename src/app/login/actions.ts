"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn, signOut } from "@/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

export type AuthState = { error?: string } | null;

/** Sign in with email + password. Returns { error: "invalid" } on bad credentials. */
export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/capture",
    });
    return null;
  } catch (error) {
    // A successful signIn throws a redirect (NEXT_REDIRECT) that must propagate.
    if (error instanceof AuthError) return { error: "invalid" };
    throw error;
  }
}

const RegisterSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

/** Create an account, then sign the new user in. */
export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = RegisterSchema.safeParse({
    name: (formData.get("name") as string) || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "weak" };

  const { name, email, password } = parsed.data;
  const db = getDb();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "taken" };

  await db.insert(users).values({ email, name: name ?? null, passwordHash: await hashPassword(password) });

  try {
    await signIn("credentials", { email, password, redirectTo: "/capture" });
    return null;
  } catch (error) {
    if (error instanceof AuthError) return { error: "invalid" };
    throw error;
  }
}

/** OAuth sign-in; the provider id travels in a hidden form field. */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider"));
  await signIn(provider, { redirectTo: "/capture" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/capture" });
}
