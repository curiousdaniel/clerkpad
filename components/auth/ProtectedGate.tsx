"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  readOfflineGateAllowed,
  writeOfflineSessionSnapshot,
} from "@/lib/auth/offlineSession";

export function ProtectedGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [offlineOk, setOfflineOk] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOfflineOk(readOfflineGateAllowed());
  }, []);

  useEffect(() => {
    if (session) {
      writeOfflineSessionSnapshot(session);
    }
  }, [session]);

  useEffect(() => {
    const sync = () => setOfflineOk(readOfflineGateAllowed());
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
      <div className="flex min-h-screen items-center justify-center bg-surface text-muted dark:bg-slate-950 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated" && !offlineOk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-muted dark:bg-slate-950 dark:text-slate-400">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
