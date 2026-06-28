"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/** Used with `useActionState` from the password form. Returns "invalid" on a bad password. */
export async function signInWithPassword(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  try {
    await signIn("credentials", {
      password: formData.get("password"),
      redirectTo: "/capture",
    });
    return null;
  } catch (error) {
    // A successful signIn throws a redirect (NEXT_REDIRECT) that must propagate.
    if (error instanceof AuthError) return "invalid";
    throw error;
  }
}

/** OAuth sign-in; the provider id travels in a hidden form field. */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider"));
  await signIn(provider, { redirectTo: "/capture" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
