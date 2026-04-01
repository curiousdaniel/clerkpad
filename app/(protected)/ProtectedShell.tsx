"use client";

import { ProtectedGate } from "@/components/auth/ProtectedGate";
import { EventProvider } from "@/components/providers/EventProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <EventProvider>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </EventProvider>
    </ProtectedGate>
  );
}
