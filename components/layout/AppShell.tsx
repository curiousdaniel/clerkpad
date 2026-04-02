"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PoweredByFooter } from "./PoweredByFooter";
import { DisplayPrefsRoot } from "./DisplayPrefsRoot";

export function AppShell({
  children,
  topBanner,
}: {
  children: ReactNode;
  topBanner?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DisplayPrefsRoot />
        <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          {topBanner ? (
            <div className="mx-auto mb-4 max-w-6xl">{topBanner}</div>
          ) : null}
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <PoweredByFooter />
      </div>
    </div>
  );
}
