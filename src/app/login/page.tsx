import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

// The sign-in screen has no SEO value and shouldn't appear in search results.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Public sign-in / register screen — rendered outside the (modules) group so it has no map shell.
export default async function LoginPage() {
  // Already signed in? Send back to the app.
  if (await auth()) redirect("/capture");

  const oauth: ("github" | "google")[] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) oauth.push("github");
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) oauth.push("google");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-background to-muted/40 p-4">
      <LoginForm oauth={oauth} />
    </main>
  );
}
