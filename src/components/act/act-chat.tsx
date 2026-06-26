"use client";

import { useRef, useState } from "react";
import { Send, X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n/provider";

type Message = { role: "user" | "assistant"; content: string; tools: string[] };

export function ActChat({
  onFeatures,
  onReset,
  onClose,
}: {
  onFeatures: (features: GeoJSON.Feature[]) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollBottom = useRef<HTMLDivElement>(null);

  function patchLast(fn: (m: Message) => Message) {
    setMessages((ms) => {
      const next = [...ms];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }

  async function run(task: string) {
    if (!task.trim() || busy) return;
    setBusy(true);
    setInput("");
    onReset();
    setMessages((m) => [...m, { role: "user", content: task, tools: [] }, { role: "assistant", content: "", tools: [] }]);
    try {
      const res = await fetch("/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "text") patchLast((m) => ({ ...m, content: m.content + ev.delta }));
            else if (ev.type === "tool") patchLast((m) => ({ ...m, tools: [...m.tools, ev.name] }));
            else if (ev.type === "features") onFeatures(ev.features as GeoJSON.Feature[]);
            else if (ev.type === "error") patchLast((m) => ({ ...m, content: m.content + `\n⚠ ${ev.error}` }));
          }
          scrollBottom.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, content: m.content + `\n⚠ ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      window.dispatchEvent(new Event("locus:ai-used")); // refresh the AI quota badge
      setBusy(false);
    }
  }

  const examples = [t("act.example1"), t("act.example2")];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("nav.act")}</h2>
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
              <p>{t("act.empty")}</p>
              <div className="flex flex-col gap-1.5">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => run(ex)}
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
                {msg.tools.length ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {msg.tools.map((name, j) => (
                      <span key={j} className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                        <Wrench className="size-3" />
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content || <span className="text-muted-foreground">{t("act.working")}</span>}
                </div>
              </div>
            ),
          )}
          <div ref={scrollBottom} />
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run(input);
            }
          }}
          rows={1}
          placeholder={t("act.placeholder")}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("act.send")}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
