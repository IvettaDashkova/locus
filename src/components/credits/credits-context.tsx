"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-context";

type CreditsValue = {
  /** Remaining AI credits for the signed-in user, or null while unknown / signed out. */
  balance: number | null;
  /** Whether the credit paywall is active (Stripe configured). When false, AI is not credit-gated. */
  enabled: boolean;
  /** Re-fetch the balance from the server. */
  refresh: () => void;
  /** Start Stripe Checkout for a credit pack, returning to `returnTo` after payment. */
  startCheckout: (returnTo?: string) => Promise<void>;
  checkoutBusy: boolean;
};

const CreditsContext = createContext<CreditsValue>({
  balance: null,
  enabled: false,
  refresh: () => {},
  startCheckout: async () => {},
  checkoutBusy: false,
});

/**
 * Tracks the signed-in user's AI credit balance and drives the buy flow. Refreshes on mount, on
 * window focus, and after each AI request (`locus:ai-used`, already dispatched by the chats) so the
 * header pill decrements live. On return from Stripe (`?checkout=success`) it refreshes and cleans
 * the URL. No-ops for signed-out users.
 */
export function CreditsProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setBalance(null);
      return;
    }
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBalance(typeof data.balance === "number" ? data.balance : null);
        setEnabled(Boolean(data.enabled));
      }
    } catch {
      /* ignore */
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const onFocus = () => refresh();
    const onUsed = () => setTimeout(refresh, 800); // let the server finish deducting first
    window.addEventListener("focus", onFocus);
    window.addEventListener("locus:ai-used", onUsed);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("locus:ai-used", onUsed);
    };
  }, [refresh]);

  // Coming back from Stripe Checkout: confirm the session server-side (credits the account even with
  // no webhook configured — idempotent, so it's harmless if the webhook also fires), then strip the
  // query so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    const sessionId = params.get("session_id");
    (async () => {
      if (sessionId) {
        try {
          const res = await fetch("/api/checkout/confirm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.balance === "number") setBalance(data.balance);
          }
        } catch {
          /* fall back to a plain refresh below */
        }
      }
      refresh();
    })();
    params.delete("checkout");
    params.delete("session_id");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [refresh]);

  const startCheckout = useCallback(async (returnTo?: string) => {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: returnTo ?? window.location.pathname }),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url as string;
    } catch {
      /* ignore — button re-enables */
    } finally {
      setCheckoutBusy(false);
    }
  }, []);

  return (
    <CreditsContext.Provider value={{ balance, enabled, refresh, startCheckout, checkoutBusy }}>
      {children}
    </CreditsContext.Provider>
  );
}

export const useCredits = () => useContext(CreditsContext);
