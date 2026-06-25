"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { useMediaQuery } from "@/lib/use-media-query";
import { useMapContext } from "@/components/map/map-context";
import { AskChat } from "./ask-chat";
import { AskPinsLayer, type AskSource } from "./ask-pins-layer";

const PANEL_WIDTH = 420;

export function AskWorkspace() {
  const { t } = useI18n();
  const { map, setControlsCorner } = useMapContext();
  const isWide = useMediaQuery("(min-width: 768px)");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [open, setOpen] = useState(false); // chat opens like Capture's "New form"

  // Ask's panel slides in from the left → move the map controls to the right so they don't clash.
  useEffect(() => {
    setControlsCorner("bottom-right");
    return () => setControlsCorner("bottom-left");
  }, [setControlsCorner]);

  // Reserve the open panel's width in the map camera (desktop) so pins center in the visible area.
  useEffect(() => {
    if (!map) return;
    const left = open && isWide ? PANEL_WIDTH : 0;
    map.setPadding({ top: 0, bottom: 0, right: 0, left });
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
      <AskPinsLayer sources={sources} />

      {/* Button to open the chat (mirrors Capture's "New form") */}
      {!open ? (
        <div className="pointer-events-auto absolute left-4 top-4">
          <Button onClick={() => setOpen(true)} className="gap-2 shadow-lg">
            <MessageSquare className="size-4" />
            {t("nav.ask")}
          </Button>
        </div>
      ) : null}

      {/* Slide-over chat — non-modal, so the map + pins stay visible and interactive */}
      <aside
        className={cn(
          "absolute left-0 top-0 h-full w-full border-r bg-card/95 shadow-xl backdrop-blur transition-transform duration-200 md:w-[420px]",
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <AskChat onSources={setSources} onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
