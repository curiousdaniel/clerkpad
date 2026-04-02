"use client";

import { ProtectedGate } from "@/components/auth/ProtectedGate";
import { UserDbProvider } from "@/components/providers/UserDbProvider";
import { EventProvider } from "@/components/providers/EventProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { CloudSyncProvider } from "@/components/providers/CloudSyncProvider";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <UserDbProvider>
        <EventProvider>
          <ToastProvider>
            <CloudSyncProvider>{children}</CloudSyncProvider>
          </ToastProvider>
        </EventProvider>
      </UserDbProvider>
    </ProtectedGate>
  );
}
