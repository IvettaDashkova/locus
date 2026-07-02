"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/provider";
import type { SubmissionItem } from "./submissions-list";

export function SubmissionDetail({
  item,
  open,
  onOpenChange,
  onFlyTo,
}: {
  item: SubmissionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFlyTo: (item: SubmissionItem) => void;
}) {
  const { t, locale } = useI18n();
  if (!item) return null;

  const created = new Date(item.createdAt).toLocaleString(locale);
  const locationLabel = item.geometry
    ? item.geometry.type === "Point"
      ? `Point ${(item.geometry.coordinates as number[]).map((n) => n.toFixed(4)).join(", ")}`
      : item.geometry.type
    : t("detail.noLocation");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.siteName ?? item.formName}</DialogTitle>
          <DialogDescription>
            {t("detail.form")}: {item.formName} · {created}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{t("detail.site")}</dt>
          <dd>{item.siteName ?? "—"}</dd>
          <dt className="text-muted-foreground">{t("detail.location")}</dt>
          <dd>{locationLabel}</dd>
        </dl>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">{t("detail.data")}</div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </div>

        {item.geometry ? (
          <Button
            variant="secondary"
            onClick={() => {
              onFlyTo(item);
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <MapPin className="size-4" />
            {t("detail.flyTo")}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
