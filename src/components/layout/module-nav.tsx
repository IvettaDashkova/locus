"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, MessagesSquare, Workflow, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; hint: string };

const ITEMS: NavItem[] = [
  { href: "/capture", label: "Capture", icon: ClipboardList, hint: "Schema-driven geo forms" },
  { href: "/ask", label: "Ask", icon: MessagesSquare, hint: "Geospatial RAG assistant" },
  { href: "/act", label: "Act", icon: Workflow, hint: "Agent with map tools" },
  { href: "/tracks", label: "Tracks", icon: Route, hint: "Trajectory analytics" },
];

export function ModuleNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {ITEMS.map(({ href, label, icon: Icon, hint }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={hint}
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
