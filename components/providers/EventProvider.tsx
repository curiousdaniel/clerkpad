"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionEvent } from "@/lib/db";
import { setCurrentEventId } from "@/lib/settings";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

type EventContextValue = {
  ready: boolean;
  currentEventId: number | null;
  currentEvent: AuctionEvent | undefined;
  switchEvent: (id: number | null) => Promise<void>;
  refresh: () => void;
};

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const { db, ready: dbReady } = useUserDb();
  const [tick, setTick] = useState(0);

  const settings = useLiveQuery(
    async () =>
      liveQueryGuard("settings.get", async () => {
        if (!dbReady || !db) return undefined;
        return db.settings.get(1);
      }, undefined),
    [dbReady, db, tick]
  );

  const currentEventId = settings?.currentEventId ?? null;

  const currentEvent = useLiveQuery(
    async () =>
      liveQueryGuard("events.get(current)", async () => {
        if (!dbReady || !db || currentEventId == null) return undefined;
        return db.events.get(currentEventId);
      }, undefined),
    [dbReady, db, currentEventId, tick]
  );

  const switchEvent = useCallback(
    async (id: number | null) => {
      if (!db) return;
      await setCurrentEventId(db, id);
      setTick((t) => t + 1);
    },
    [db]
  );

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<EventContextValue>(
    () => ({
      ready: dbReady,
      currentEventId,
      currentEvent,
      switchEvent,
      refresh,
    }),
    [dbReady, currentEventId, currentEvent, switchEvent, refresh]
  );

  return (
    <EventContext.Provider value={value}>{children}</EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useEventContext must be used within EventProvider");
  }
  return ctx;
}
