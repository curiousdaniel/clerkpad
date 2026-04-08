"use client";

import { ProtectedGate } from "@/components/auth/ProtectedGate";
import { UserDbProvider } from "@/components/providers/UserDbProvider";
import { EventProvider } from "@/components/providers/EventProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { LoginAnnouncementProvider } from "@/components/providers/LoginAnnouncementProvider";
import { CloudSyncProvider } from "@/components/providers/CloudSyncProvider";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedGate>
      <UserDbProvider>
        <EventProvider>
          <ToastProvider>
            <LoginAnnouncementProvider>
              <CloudSyncProvider>{children}</CloudSyncProvider>
            </LoginAnnouncementProvider>
          </ToastProvider>
        </EventProvider>
      </UserDbProvider>
    </ProtectedGate>
  );
}
