"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Check, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

/** Shared colours for the SVG demos — chosen to read on both light and dark themes. */
export const LAB_COLORS = {
  problem: "#ef4444", // red — the naive/broken result
  solution: "#10b981", // emerald — the fixed result
  truth: "#94a3b8", // slate — ground truth / reference
  neutral: "#3b82f6", // blue — raw data
  accent: "#f59e0b", // amber — highlights
} as const;

export function DemoCard({
  index,
  icon,
  title,
  blurb,
  children,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <Card className="scroll-mt-20" id={`demo-${index}`}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {String(index).padStart(2, "0")}
              </span>
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{blurb}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

type Tone = "problem" | "solution" | "neutral";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; tone?: Tone }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone ?? "neutral";
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              !active && "text-muted-foreground hover:text-foreground",
              active && tone === "problem" && "bg-background text-red-600 shadow-sm dark:text-red-400",
              active && tone === "solution" && "bg-background text-emerald-600 shadow-sm dark:text-emerald-400",
              active && tone === "neutral" && "bg-background text-foreground shadow-sm",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Insight({ tone, children }: { tone: "problem" | "solution"; children: ReactNode }) {
  const problem = tone === "problem";
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border-l-2 px-3 py-2 text-sm",
        problem
          ? "border-l-red-500 bg-red-500/5 text-red-700 dark:text-red-300"
          : "border-l-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {problem ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The business-impact takeaway — highlighted so a non-technical reader sees the value at a glance. */
export function Impact({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2.5 rounded-lg bg-primary/5 px-3 py-2.5 ring-1 ring-primary/15">
      <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 text-sm">
        <span className="font-semibold text-primary">{t("lab.impactLabel")}: </span>
        <span className="text-foreground/90">{children}</span>
      </div>
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
