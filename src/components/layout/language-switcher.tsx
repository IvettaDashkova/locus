"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/messages";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          // Include the visible locale code in the accessible name so it matches the button's visible
          // text (WCAG "label in name" — fixes Lighthouse label-content-name-mismatch).
          <Button variant="ghost" size="sm" className="gap-1.5" aria-label={`${t("lang.label")} (${locale.toUpperCase()})`} />
        }
      >
        <Languages className="size-4" />
        <span className="text-xs font-medium uppercase">{locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)} data-active={l === locale}>
            <span className={l === locale ? "font-semibold" : ""}>{LOCALE_NAMES[l]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
