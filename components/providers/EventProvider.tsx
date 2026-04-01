"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionEvent } from "@/lib/db";
import { db } from "@/lib/db";
import { ensureSettingsRow, setCurrentEventId } from "@/lib/settings";

type EventContextValue = {
  ready: boolean;
  currentEventId: number | null;
  currentEvent: AuctionEvent | undefined;
  switchEvent: (id: number | null) => Promise<void>;
  refresh: () => void;
};

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSettingsRow();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = useLiveQuery(
    async () => {
      if (!ready) return undefined;
      return db.settings.get(1);
    },
    [ready, tick]
  );

  const currentEventId = settings?.currentEventId ?? null;

  const currentEvent = useLiveQuery(
    async () => {
      if (!ready || currentEventId == null) return undefined;
      return db.events.get(currentEventId);
    },
    [ready, currentEventId, tick]
  );

  const switchEvent = useCallback(async (id: number | null) => {
    await setCurrentEventId(id);
    setTick((t) => t + 1);
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<EventContextValue>(
    () => ({
      ready,
      currentEventId,
      currentEvent,
      switchEvent,
      refresh,
    }),
    [ready, currentEventId, currentEvent, switchEvent, refresh]
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
