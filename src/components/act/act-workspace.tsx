"use client";

import { useEffect, useState } from "react";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { useMapContext } from "@/components/map/map-context";
import { ActChat } from "./act-chat";
import { ActResultsLayer } from "./act-results-layer";

const PANEL_WIDTH = 420;

export function ActWorkspace() {
  const { t } = useI18n();
  const { map, setControlsCorner } = useMapContext();
  const isWide = useMediaQuery("(min-width: 768px)");
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setControlsCorner("bottom-right");
    return () => setControlsCorner("bottom-left");
  }, [setControlsCorner]);

  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 0, bottom: 0, right: 0, left: open && isWide ? PANEL_WIDTH : 0 });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map, isWide, open]);

  return (
    <>
      <ActResultsLayer features={features} />

      {!open ? (
        <div className="pointer-events-auto absolute left-4 top-4">
          <Button onClick={() => setOpen(true)} className="gap-2 shadow-lg">
            <Workflow className="size-4" />
            {t("nav.act")}
          </Button>
        </div>
      ) : null}

      <aside
        className={cn(
          "absolute left-0 top-0 h-full w-full border-r bg-card/95 shadow-xl backdrop-blur transition-transform duration-200 md:w-[420px]",
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <ActChat
          onFeatures={(fs) => setFeatures((cur) => [...cur, ...fs])}
          onReset={() => setFeatures([])}
          onClose={() => setOpen(false)}
        />
      </aside>
    </>
  );
}
