"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OFFLINE_SESSION_STORAGE_KEY } from "@/lib/auth/offlineSession";

function readOfflineCache(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.onLine) return false;
  try {
    const raw = sessionStorage.getItem(OFFLINE_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const { expires, user } = JSON.parse(raw) as {
      expires: string;
      user?: unknown;
    };
    return Boolean(user && new Date(expires) > new Date());
  } catch {
    return false;
  }
}

export function ProtectedGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [offlineOk, setOfflineOk] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOfflineOk(readOfflineCache());
  }, []);

  useEffect(() => {
    if (session) {
      try {
        sessionStorage.setItem(
          OFFLINE_SESSION_STORAGE_KEY,
          JSON.stringify({ expires: session.expires, user: session.user })
        );
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [session]);

  useEffect(() => {
    const sync = () => setOfflineOk(readOfflineCache());
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;
    if (status === "authenticated") return;
    if (offlineOk) return;
    router.replace("/login/");
  }, [mounted, status, offlineOk, router]);

  if (!mounted || (status === "loading" && !offlineOk)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-muted">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated" && !offlineOk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
