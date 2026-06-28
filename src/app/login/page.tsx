import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

// Public sign-in screen — rendered outside the (modules) group so it has no map shell.
export default async function LoginPage() {
  // Already signed in? Skip the gate.
  if (await auth()) redirect("/capture");

  const oauth: ("github" | "google")[] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) oauth.push("github");
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) oauth.push("google");

  // Show the demo-password hint only when no custom password is set (i.e. the "locus" default).
  const showDemoHint = !process.env.APP_ACCESS_PASSWORD;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-background to-muted/40 p-4">
      <LoginForm oauth={oauth} showDemoHint={showDemoHint} />
    </main>
  );
}
