"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Package,
  Gavel,
  FileText,
  BarChart3,
  CircleHelp,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { OFFLINE_SESSION_STORAGE_KEY } from "@/lib/auth/offlineSession";
import { closeAndClearAuctionDbCache } from "@/lib/db";
import { EventSwitcher } from "./EventSwitcher";

const nav = [
  { href: "/dashboard/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events/", label: "Events", icon: CalendarDays },
  { href: "/bidders/", label: "Bidders", icon: Users },
  { href: "/consignors/", label: "Consignors", icon: Package },
  { href: "/clerking/", label: "Clerking", icon: Gavel },
  { href: "/invoices/", label: "Invoices", icon: FileText },
  { href: "/reports/", label: "Reports", icon: BarChart3 },
  { href: "/help/", label: "Help", icon: CircleHelp },
  { href: "/settings/", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-navy/10 bg-surface dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-navy/10 p-4 dark:border-slate-700">
        <Link href="/dashboard/" className="block">
          <span className="text-lg font-bold tracking-tight text-navy dark:text-slate-100">
            Clerk<span className="text-gold">Bid</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted dark:text-slate-400">
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
          const active = p === h || p.startsWith(`${h}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-navy shadow-sm ring-1 ring-navy/10 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
                  : "text-muted hover:bg-white/60 hover:text-ink dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-navy/10 p-3 dark:border-slate-700">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-white/60 hover:text-ink dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
          onClick={() => {
            try {
              sessionStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
            } catch {
              /* ignore */
            }
            closeAndClearAuctionDbCache();
            void signOut({ callbackUrl: "/login/" });
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
