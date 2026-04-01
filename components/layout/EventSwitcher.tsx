"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";

export function EventSwitcher() {
  const { ready, currentEventId, switchEvent } = useCurrentEvent();
  const events = useLiveQuery(
    async () => {
      if (!ready) return [];
      return db.events.orderBy("createdAt").reverse().toArray();
    },
    [ready]
  );

  if (!ready || !events) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white px-3 py-2 text-xs text-muted">
        Loading events…
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="event-switcher" className="sr-only">
        Current event
      </label>
      <select
        id="event-switcher"
        className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm font-medium text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        value={currentEventId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          void switchEvent(v === "" ? null : Number(v));
        }}
      >
        <option value="">No event selected</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name}
          </option>
        ))}
      </select>
    </div>
  );
}
