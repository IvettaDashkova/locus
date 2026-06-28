"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MapPin, LogIn, UserPlus, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { signInWithPassword, register, signInWithProvider, type AuthState } from "./actions";

type Mode = "signin" | "register";

/** The sign-in / register card. `oauth` lists which OAuth providers are configured (server-decided). */
export function LoginForm({ oauth }: { oauth: ("github" | "google")[] }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signInWithPassword : register,
    null,
  );

  const errorKey =
    state?.error === "invalid"
      ? "auth.invalid"
      : state?.error === "taken"
        ? "auth.taken"
        : state?.error === "weak"
          ? "auth.weak"
          : null;

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card/95 p-6 shadow-xl backdrop-blur">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <MapPin className="size-6 text-primary" />
        </div>
        <h1 className="text-lg font-semibold">{t(mode === "signin" ? "auth.title" : "auth.registerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
      </div>

      {/* key=mode resets the form fields and useActionState error when switching tabs */}
      <form action={action} className="space-y-3" key={mode}>
        {mode === "register" ? (
          <Field icon={<User className="size-4" />}>
            <input
              name="name"
              type="text"
              autoComplete="name"
              placeholder={t("auth.name")}
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </Field>
        ) : null}
        <Field icon={<Mail className="size-4" />}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("auth.email")}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </Field>
        <Field icon={<Lock className="size-4" />}>
          <input
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            placeholder={t("auth.password")}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </Field>

        {errorKey ? <p className="text-sm text-destructive">⚠ {t(errorKey)}</p> : null}

        <Button type="submit" disabled={pending} className="w-full gap-2">
          {mode === "signin" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
          {pending
            ? t("auth.signing")
            : t(mode === "signin" ? "auth.signin" : "auth.register")}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "signin" ? "register" : "signin"))}
        className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {t(mode === "signin" ? "auth.toRegister" : "auth.toSignin")}
      </button>

      {oauth.length ? (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {oauth.map((p) => (
              <form key={p} action={signInWithProvider}>
                <input type="hidden" name="provider" value={p} />
                <Button type="submit" variant="outline" className="w-full gap-2">
                  <LogIn className="size-4" />
                  {t(p === "github" ? "auth.github" : "auth.google")}
                </Button>
              </form>
            ))}
          </div>
        </>
      ) : null}

      <Link
        href="/capture"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t("auth.backToApp")}
      </Link>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}
