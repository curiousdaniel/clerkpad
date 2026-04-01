"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Gavel,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";
import { EventSwitcher } from "./EventSwitcher";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events/", label: "Events", icon: CalendarDays },
  { href: "/bidders/", label: "Bidders", icon: Users },
  { href: "/clerking/", label: "Clerking", icon: Gavel },
  { href: "/invoices/", label: "Invoices", icon: FileText },
  { href: "/reports/", label: "Reports", icon: BarChart3 },
  { href: "/settings/", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-navy/10 bg-surface">
      <div className="border-b border-navy/10 p-4">
        <Link href="/" className="block">
          <span className="text-lg font-bold tracking-tight text-navy">
            Clerk<span className="text-gold">Bid</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Auction clerking
          </span>
        </Link>
        <div className="mt-4">
          <EventSwitcher />
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3" aria-label="Main">
        {nav.map(({ href, label, icon: Icon }) => {
          const p = (pathname ?? "/").replace(/\/$/, "") || "/";
          const h = href.replace(/\/$/, "") || "/";
          const active =
            h === "/" ? p === "/" : p === h || p.startsWith(`${h}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-navy shadow-sm ring-1 ring-navy/10"
                  : "text-muted hover:bg-white/60 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
