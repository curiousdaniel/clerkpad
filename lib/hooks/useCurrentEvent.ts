"use client";

import { useEventContext } from "@/components/providers/EventProvider";

export function useCurrentEvent() {
  return useEventContext();
}
