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

const PANEL_WIDTH = 400;

export function AskWorkspace() {
  const { t } = useI18n();
  const { map } = useMapContext();
  const isWide = useMediaQuery("(min-width: 768px)");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [mobileMap, setMobileMap] = useState(false); // mobile: viewing the map instead of the chat

  // Reserve the docked chat width in the map camera (desktop) so pins center in the visible area.
  useEffect(() => {
    if (!map) return;
    map.setPadding({ top: 0, bottom: 0, right: 0, left: isWide ? PANEL_WIDTH : 0 });
    return () => {
      try {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      } catch {
        /* map may be gone */
      }
    };
  }, [map, isWide]);

  return (
    <>
      <AskPinsLayer sources={sources} />

      <aside
        className={cn(
          "pointer-events-auto absolute left-0 top-0 h-full w-full border-r bg-card/95 shadow-xl backdrop-blur md:w-[400px]",
          mobileMap && "hidden md:block",
        )}
      >
        <AskChat onSources={setSources} onShowMap={() => setMobileMap(true)} />
      </aside>

      {mobileMap ? (
        <div className="pointer-events-auto absolute left-4 top-4 md:hidden">
          <Button onClick={() => setMobileMap(false)} className="gap-2 shadow-lg">
            <MessageSquare className="size-4" />
            {t("ask.chat")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
