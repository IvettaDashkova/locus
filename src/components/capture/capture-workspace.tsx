"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/provider";
import { useMapContext } from "@/components/map/map-context";

const RAIL_WIDTH = 320; // matches the w-80 submissions rail
import { FormStudio, type SaveResult } from "./form-studio";
import { SubmissionsList, type SubmissionItem } from "./submissions-list";
import { SubmissionDetail } from "./submission-detail";
import { SubmissionsLayer } from "./submissions-layer";

export function CaptureWorkspace() {
  const { t } = useI18n();
  const { map } = useMapContext();
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [studioOpen, setStudioOpen] = useState(false);
  const [selected, setSelected] = useState<SubmissionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions");
      const body = await res.json();
      if (res.ok) setItems(body.items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Load submissions on mount (async fetch → setState happens later, not synchronously).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Reserve the right rail's width in the map camera so pins center in the visible area.
  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: RAIL_WIDTH });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map]);

  async function onSaved(result: SaveResult) {
    setStudioOpen(false);
    await refresh();
    if (result.siteId) setFocusId(result.submissionId);
  }

  function openDetail(item: SubmissionItem) {
    setSelected(item);
    setDetailOpen(true);
  }

  return (
    <>
      {/* Pins on the shared map */}
      <SubmissionsLayer items={items} focusId={focusId} />

      {/* "+ New form" button */}
      <div className="pointer-events-auto absolute left-4 top-4">
        <Button onClick={() => setStudioOpen(true)} className="gap-2 shadow-lg">
          <Plus className="size-4" />
          {t("capture.newForm")}
        </Button>
      </div>

      {/* Right rail: submissions list */}
      <aside className="pointer-events-auto absolute right-0 top-0 h-full w-80 max-w-[85vw] border-l bg-card/95 shadow-xl backdrop-blur">
        <SubmissionsList
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={(it) => {
            setFocusId(it.id);
            openDetail(it);
          }}
        />
      </aside>

      {/* Generation slide-over (left) */}
      <Sheet open={studioOpen} onOpenChange={setStudioOpen}>
        <SheetContent
          side="left"
          className="flex flex-col gap-0 p-0 data-[side=left]:w-[50vw] data-[side=left]:sm:max-w-[50vw]"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{t("capture.studioTitle")}</SheetTitle>
            <SheetDescription>{t("capture.studioDesc")}</SheetDescription>
          </SheetHeader>
          <FormStudio onSaved={onSaved} />
        </SheetContent>
      </Sheet>

      {/* Detail dialog */}
      <SubmissionDetail
        item={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onFlyTo={(it) => setFocusId(it.id)}
      />
    </>
  );
}
