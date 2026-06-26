"use client";

import { useRef, useState, type ReactNode } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n/provider";
import type { AskSource } from "./ask-pins-layer";

type Message = { role: "user" | "assistant"; content: string; sources?: AskSource[] };

function renderWithCitations(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      return (
        <sup key={i} className="mx-0.5 rounded bg-primary/15 px-1 font-medium text-primary">
          {m[1]}
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AskChat({ onSources, onClose }: { onSources: (s: AskSource[]) => void; onClose?: () => void }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollBottom = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      let sources: AskSource[] = [];
      const header = res.headers.get("x-locus-sources");
      if (header) {
        try {
          // base64 of UTF-8 bytes → decode bytes (atob alone mangles ń/ó/…).
          const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
          sources = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          /* ignore */
        }
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
          scrollBottom.current?.scrollIntoView({ behavior: "smooth" });
        }
      }

      // Show/plot only the sources actually cited in the answer (not every retrieved candidate).
      const cited = new Set([...acc.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      const usedSources = sources.filter((s) => cited.has(s.n));
      onSources(usedSources);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: acc, sources: usedSources };
        return next;
      });
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: String(e) };
        return next;
      });
    } finally {
      window.dispatchEvent(new Event("locus:ai-used")); // refresh the AI quota badge
      setBusy(false);
    }
  }

  const examples = [t("ask.example1"), t("ask.example2")];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("nav.ask")}</h2>
        {onClose ? (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t("ask.empty")}</p>
              <div className="flex flex-col gap-1.5">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => ask(ex)}
                    className="rounded-md border px-3 py-2 text-left text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                {msg.content}
              </div>
            ) : (
              <div key={i} className="max-w-[92%] space-y-2">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed">
                  {msg.content ? renderWithCitations(msg.content) : <span className="text-muted-foreground">{t("ask.searching")}</span>}
                </div>
                {msg.sources?.length ? (
                  <div className="space-y-1 px-1">
                    <div className="text-xs font-medium text-muted-foreground">{t("ask.sources")}</div>
                    {msg.sources.map((s) => (
                      <div key={s.n} className="flex gap-1.5 text-xs">
                        <span className="font-medium text-primary">[{s.n}]</span>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="truncate underline hover:text-foreground">
                            {s.title ?? s.source}
                          </a>
                        ) : (
                          <span className="truncate">{s.title ?? s.source}</span>
                        )}
                        {s.license ? <span className="shrink-0 text-muted-foreground">· {s.license}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
          <div ref={scrollBottom} />
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder={t("ask.placeholder")}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("ask.send")}>
          <Send className="size-4" />
        </Button>
      </form>

      <p className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">{t("ask.attribution")}</p>
    </div>
  );
}
