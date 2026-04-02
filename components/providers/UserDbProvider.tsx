"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import {
  getAuctionDB,
  migrateLegacyToUserDb,
  type AuctionDB,
} from "@/lib/db";
import { ensureSettingsRow } from "@/lib/settings";
import { OFFLINE_SESSION_STORAGE_KEY } from "@/lib/auth/offlineSession";

export type UserDbContextValue = {
  db: AuctionDB | null;
  /** Legacy migration + settings row ready for this user. */
  ready: boolean;
};

const UserDbContext = createContext<UserDbContextValue | null>(null);

function readOfflineUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OFFLINE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const { user } = JSON.parse(raw) as { user?: { id?: string } };
    const id = user?.id;
    return id != null && String(id).length > 0 ? String(id) : null;
  } catch {
    return null;
  }
}

export function UserDbProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [offlineUid, setOfflineUid] = useState<string | null>(() =>
    readOfflineUserId()
  );

  useEffect(() => {
    const sync = () => setOfflineUid(readOfflineUserId());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) setOfflineUid(readOfflineUserId());
  }, [session?.user?.id]);

  const rawUserId = session?.user?.id ?? offlineUid ?? null;
  const userId =
    rawUserId != null && String(rawUserId).length > 0
      ? String(rawUserId)
      : null;

  const db = useMemo(() => {
    if (!userId) return null;
    return getAuctionDB(userId);
  }, [userId]);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!db) {
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await migrateLegacyToUserDb(db);
        await ensureSettingsRow(db);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const value = useMemo<UserDbContextValue>(
    () => ({ db, ready: ready && db != null }),
    [db, ready]
  );

  return (
    <UserDbContext.Provider value={value}>{children}</UserDbContext.Provider>
  );
}

export function useUserDb(): UserDbContextValue {
  const ctx = useContext(UserDbContext);
  if (!ctx) {
    throw new Error("useUserDb must be used within UserDbProvider");
  }
  return ctx;
}
