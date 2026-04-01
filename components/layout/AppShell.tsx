"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PoweredByFooter } from "./PoweredByFooter";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <PoweredByFooter />
      </div>
    </div>
  );
}
