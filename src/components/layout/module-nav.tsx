"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, MessagesSquare, Workflow, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

type NavItem = { href: string; icon: LucideIcon; key: string };

const ITEMS: NavItem[] = [
  { href: "/capture", icon: ClipboardList, key: "capture" },
  { href: "/ask", icon: MessagesSquare, key: "ask" },
  { href: "/act", icon: Workflow, key: "act" },
  { href: "/tracks", icon: Route, key: "tracks" },
];

export function ModuleNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {ITEMS.map(({ href, icon: Icon, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const label = t(`nav.${key}`);
        return (
          <Link
            key={href}
            href={href}
            title={t(`nav.${key}.hint`)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
