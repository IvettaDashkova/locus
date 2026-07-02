"use client";

import { useState, type ReactNode } from "react";
import { MessageSquarePlus, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/provider";

type Status = "idle" | "sending" | "sent" | "error";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A "suggestions & remarks" form in a dialog. The trigger is configurable so the same component
 * serves the top-bar (icon-only) and the landing page (a labelled button). Submissions go to
 * POST /api/feedback, which emails them to the site owner.
 */
export function FeedbackDialog({
  variant = "outline",
  size = "sm",
  iconOnly = false,
  className,
  triggerLabel,
  trigger,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  iconOnly?: boolean;
  className?: string;
  triggerLabel?: string;
  /** Fully custom trigger; overrides the default button when provided. */
  trigger?: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — stays empty for humans
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const label = triggerLabel ?? t("feedback.trigger");

  function reset() {
    setName("");
    setEmail("");
    setMessage("");
    setWebsite("");
    setStatus("idle");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3 || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          {trigger}
        </button>
      ) : (
        <Button
          variant={variant}
          size={iconOnly ? "icon" : size}
          onClick={() => setOpen(true)}
          className={className}
          aria-label={label}
          title={iconOnly ? label : undefined}
        >
          <MessageSquarePlus className="size-4" />
          {iconOnly ? null : <span>{label}</span>}
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTimeout(reset, 200); // reset after the close animation
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("feedback.title")}</DialogTitle>
            <DialogDescription>{t("feedback.desc")}</DialogDescription>
          </DialogHeader>

          {status === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check className="size-6" />
              </div>
              <p className="text-sm font-medium">{t("feedback.success")}</p>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("feedback.close")}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-name">
                    {t("feedback.name")}
                  </label>
                  <input id="fb-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-email">
                    {t("feedback.email")}
                  </label>
                  <input
                    id="fb-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="fb-message">
                  {t("feedback.message")} <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="fb-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("feedback.messagePlaceholder")}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Honeypot — visually hidden, ignored by humans, filled by bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              {error ? <p className="text-sm text-destructive">⚠ {error}</p> : null}

              <DialogFooter>
                <Button type="submit" disabled={message.trim().length < 3 || status === "sending"} className="gap-2">
                  {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {status === "sending" ? t("feedback.sending") : t("feedback.send")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
