"use client";

import { MapPin, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n/provider";

export type SubmissionItem = {
  id: string;
  formName: string;
  siteName: string | null;
  data: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
  createdAt: string;
};

export function SubmissionsList({
  items,
  selectedId,
  onSelect,
}: {
  items: SubmissionItem[];
  selectedId: string | null;
  onSelect: (item: SubmissionItem) => void;
}) {
  const { t, locale } = useI18n();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("list.title")}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("list.empty")}</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it)}
                  data-selected={it.id === selectedId}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    {it.geometry ? (
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium">{it.siteName ?? it.formName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-5 text-xs text-muted-foreground">
                    <span className="truncate">{it.formName}</span>
                    <span className="shrink-0">{fmt(it.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
