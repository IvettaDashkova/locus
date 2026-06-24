"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALES, messages, type Locale } from "./messages";

type Params = Record<string, string | number>;
type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  for (const c of candidates) {
    const base = c.slice(0, 2).toLowerCase() as Locale;
    if (LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR renders the default; on mount we resolve the saved choice or the browser language.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" ? localStorage.getItem("locale") : null) as Locale | null;
    // Resolve the real locale on mount (client-only navigator/localStorage) to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(saved && LOCALES.includes(saved) ? saved : detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("locale", l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Params) => {
      let str = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
