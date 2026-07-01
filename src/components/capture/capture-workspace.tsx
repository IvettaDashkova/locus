"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { useMapContext } from "@/components/map/map-context";
import { FormStudio, type SaveResult } from "./form-studio";
import { SubmissionsList, type SubmissionItem } from "./submissions-list";
import { SubmissionDetail } from "./submission-detail";
import { SubmissionsLayer } from "./submissions-layer";

const RAIL_WIDTH = 320; // matches the w-80 submissions rail

export function CaptureWorkspace() {
  const { t } = useI18n();
  const { map, setControlsCorner } = useMapContext();
  const isWide = useMediaQuery("(min-width: 768px)");

  // Capture's panel/rail is on the right → keep map controls on the left.
  useEffect(() => {
    setControlsCorner("bottom-left");
  }, [setControlsCorner]);

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [studioOpen, setStudioOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false); // mobile submissions sheet
  const [selected, setSelected] = useState<SubmissionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/submissions", { signal });
      const body = await res.json();
      if (res.ok) setItems(body.items ?? []);
    } catch {
      /* ignore (includes AbortError when navigating away) */
    }
  }, []);

  useEffect(() => {
    // Abort the fetch if we navigate away before it resolves. Against a slow DB the request can be
    // in-flight for seconds; leaving it running holds one of the browser's ~6 per-host connections,
    // and enough stale requests starve the App Router's own navigation (RSC) fetches — which shows as
    // the dev "rendering" indicator hanging and the next page never appearing.
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [refresh]);

  // Reserve the right rail's width in the map camera (desktop only, where the rail is persistent).
  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: isWide ? RAIL_WIDTH : 0 });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map, isWide]);

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
      <SubmissionsLayer items={items} focusId={focusId} onSelect={openDetail} />

      {/* "+ New form" button */}
      <div className="pointer-events-auto absolute left-4 top-4">
        <Button onClick={() => setStudioOpen(true)} className="gap-2 shadow-lg">
          <Plus className="size-4" />
          {t("capture.newForm")}
        </Button>
      </div>

      {/* Mobile: button to open the submissions list */}
      <div className="pointer-events-auto absolute right-4 top-4 md:hidden">
        <Button variant="secondary" onClick={() => setListOpen(true)} className="gap-2 shadow-lg">
          <PanelRightOpen className="size-4" />
          {t("list.title")}
          <Badge variant="outline">{items.length}</Badge>
        </Button>
      </div>

      {/* Desktop: persistent right rail */}
      <aside className="pointer-events-auto absolute right-0 top-0 hidden h-full w-80 border-l bg-card/95 shadow-xl backdrop-blur md:block">
        <SubmissionsList
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={(it) => {
            setFocusId(it.id);
            openDetail(it);
          }}
        />
      </aside>

      {/* Mobile: submissions in a sheet */}
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="right" className="w-80 max-w-[88vw] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("list.title")}</SheetTitle>
          </SheetHeader>
          <SubmissionsList
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={(it) => {
              setListOpen(false);
              setFocusId(it.id);
              openDetail(it);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Generation slide-over (left) — full width on mobile, half the viewport on larger screens */}
      <Sheet open={studioOpen} onOpenChange={setStudioOpen}>
        <SheetContent
          side="left"
          className="flex flex-col gap-0 p-0 data-[side=left]:w-full data-[side=left]:sm:w-[50vw] data-[side=left]:sm:max-w-[50vw]"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{t("capture.studioTitle")}</SheetTitle>
            <SheetDescription>{t("capture.studioDesc")}</SheetDescription>
          </SheetHeader>
          <FormStudio onSaved={onSaved} />
        </SheetContent>
      </Sheet>

      <SubmissionDetail
        item={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onFlyTo={(it) => setFocusId(it.id)}
      />
    </>
  );
}
