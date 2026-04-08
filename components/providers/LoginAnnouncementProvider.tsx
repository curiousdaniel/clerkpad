"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/providers/ToastProvider";
import { handleAblyAnnounceMessage } from "@/lib/ably/handleClientAnnounce";

/**
 * Shows persisted (cross-session) announcement toasts for the signed-in user after login
 * or on first load, without waiting for Ably.
 */
export function LoginAnnouncementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { showToast } = useToast();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/announcements/pending-login/", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          announcements?: Array<{
            id: string;
            title?: string;
            body: string;
            severity?: string;
            persistedForLogin?: boolean;
          }>;
        };
        const list = data.announcements ?? [];
        for (let i = 0; i < list.length; i++) {
          if (cancelled) return;
          const a = list[i]!;
          await new Promise((r) => setTimeout(r, i * 550));
          if (cancelled) return;
          handleAblyAnnounceMessage(
            {
              id: a.id,
              title: a.title,
              body: a.body,
              severity: a.severity,
              persistedForLogin: true,
            },
            showToast
          );
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, showToast]);

  return <>{children}</>;
}
