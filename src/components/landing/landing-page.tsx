"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MapPin, ArrowRight, Code2, ExternalLink, FlaskConical, ClipboardList,
  MessagesSquare, Workflow, Route, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { useI18n } from "@/lib/i18n/provider";

const APP_URL = "https://locus-dun.vercel.app/capture";
const GITHUB_URL = "https://github.com/IvettaDashkova";
const LINKEDIN_URL = "https://linkedin.com/in/ivettadashkova";

const MODULES: { icon: LucideIcon; key: string }[] = [
  { icon: ClipboardList, key: "capture" },
  { icon: MessagesSquare, key: "ask" },
  { icon: Workflow, key: "act" },
  { icon: Route, key: "tracks" },
  { icon: FlaskConical, key: "lab" },
];

const STACK = ["Next.js", "TypeScript", "PostGIS", "pgvector", "MapLibre GL", "Vercel AI SDK", "Drizzle", "Tailwind"];

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <MapPin className="size-5 text-primary" />
          Locus
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <FeedbackDialog variant="ghost" size="sm" />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-8 py-8 md:grid-cols-2 md:py-14">
          {/* Photo with white text overlay */}
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl ring-1 ring-foreground/10 md:order-last">
            <div className="relative aspect-[4/5]">
              <Image
                src="/ivetta.jpg"
                alt="Ivetta Dashkova"
                fill
                priority
                sizes="(max-width: 768px) 90vw, 384px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Ivetta Dashkova</h1>
                <p className="mt-1 text-sm text-white/85">{t("landing.role")}</p>
              </div>
            </div>
          </div>

          {/* Intro + project + CTA */}
          <div className="flex flex-col gap-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t("landing.available")}
              </span>
              <h2 className="mt-4 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                {t("landing.headline")}
              </h2>
              <p className="mt-3 text-base text-muted-foreground">{t("landing.intro")}</p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="size-4 text-primary" />
                {t("landing.projectTitle")}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{t("landing.projectDesc")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<a href={APP_URL} />} className="gap-2">
                {t("landing.cta")}
                <ArrowRight className="size-4" />
              </Button>
              <FeedbackDialog variant="outline" size="lg" triggerLabel={t("landing.feedbackCta")} />
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Code2 className="size-4" /> GitHub
              </a>
              <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <ExternalLink className="size-4" /> LinkedIn
              </a>
            </div>
          </div>
        </section>

        {/* What's inside */}
        <section className="border-t pt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("landing.insideTitle")}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map(({ icon: Icon, key }) => (
              <div key={key} className="rounded-xl border bg-card p-4">
                <Icon className="size-5 text-primary" />
                <div className="mt-2 text-sm font-medium">{t(`nav.${key}`)}</div>
                <div className="text-xs text-muted-foreground">{t(`nav.${key}.hint`)}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span key={s} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© {t("landing.footer")}</span>
          <div className="flex items-center gap-3">
            <Link href={APP_URL} className="hover:text-foreground">
              {t("landing.cta")}
            </Link>
            <FeedbackDialog
              trigger={<span className="hover:text-foreground">{t("landing.feedbackCta")}</span>}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
