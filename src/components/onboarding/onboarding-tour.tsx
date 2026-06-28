"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

const KEY = "locus:onboarding:v1";

type Step = { target?: string; titleKey: string; bodyKey: string };

/** The tour steps. `target` is a CSS selector for the element to spotlight (centered if absent). */
const STEPS: Step[] = [
  { titleKey: "onboard.welcome.title", bodyKey: "onboard.welcome.body" },
  { target: '[data-tour="modules"]', titleKey: "onboard.modules.title", bodyKey: "onboard.modules.body" },
  { target: '[data-tour="map"]', titleKey: "onboard.map.title", bodyKey: "onboard.map.body" },
  { target: '[data-tour="topbar"]', titleKey: "onboard.actions.title", bodyKey: "onboard.actions.body" },
];

/** Fire this to (re)start the tour from anywhere: `window.dispatchEvent(new Event("locus:start-tour"))`. */
export const START_TOUR_EVENT = "locus:start-tour";

/**
 * App-wide onboarding: a dependency-free spotlight tour. Auto-runs once per browser (localStorage),
 * and can be replayed from the "?" button in the top bar. Each step dims the screen and highlights a
 * real UI element, with a card explaining it — so new visitors learn the modules, the map, and that
 * the map itself is interactive (e.g. clicking to build a route in Tracks).
 */
export function OnboardingTour() {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Auto-start once (deferred so the layout has painted), plus listen for manual restarts.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (!localStorage.getItem(KEY)) {
          setI(0);
          setRunning(true);
        }
      } catch {
        /* ignore */
      }
    }, 700);
    const onStart = () => {
      setI(0);
      setRunning(true);
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => {
      clearTimeout(id);
      window.removeEventListener(START_TOUR_EVENT, onStart);
    };
  }, []);

  const step = STEPS[i];

  // Measure the current target (deferred via rAF so we never setState synchronously in the effect).
  useEffect(() => {
    if (!running) return;
    const measure = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    let raf = requestAnimationFrame(measure);
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [running, step]);

  const finish = useCallback(() => {
    setRunning(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (!running) return null;

  const last = i === STEPS.length - 1;
  const pad = 8;

  // Position the card relative to the spotlight; center it for full-screen / missing targets.
  const big = rect ? rect.height > window.innerHeight * 0.55 || rect.width > window.innerWidth * 0.7 : false;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect && !big) {
    const W = 340;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - W - 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    cardStyle =
      spaceBelow > 220
        ? { left, top: rect.bottom + 12, width: W }
        : { left, top: rect.top - 12, width: W, transform: "translateY(-100%)" };
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dim + spotlight cutout (or a flat dim when there's no target). */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg transition-all duration-300"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/66" />
      )}

      {/* Block app interaction during the tour. */}
      <div className="absolute inset-0" />

      <div
        className="absolute max-w-[90vw] rounded-xl border bg-card p-4 shadow-2xl"
        style={cardStyle}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t(step.titleKey)}</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={finish} aria-label={t("onboard.skip")}>
            <X className="size-4" />
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("onboard.step", { i: String(i + 1), n: String(STEPS.length) })}
          </span>
          <div className="flex items-center gap-2">
            {i > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setI((v) => v - 1)} className="gap-1">
                <ArrowLeft className="size-4" />
                {t("onboard.back")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={finish}>
                {t("onboard.skip")}
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={finish}>
                {t("onboard.done")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setI((v) => v + 1)} className="gap-1">
                {t("onboard.next")}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
