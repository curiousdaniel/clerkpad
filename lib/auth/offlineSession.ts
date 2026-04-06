import type { Session } from "next-auth";

/** Storage key for JWT session snapshot (localStorage + sessionStorage) for offline PWA use. */
export const OFFLINE_SESSION_STORAGE_KEY = "clerkbid-offline-session";

export type OfflineSessionSnapshot = {
  expires: string;
  user: Session["user"];
};

function readRawSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLocal = localStorage.getItem(OFFLINE_SESSION_STORAGE_KEY);
    if (fromLocal != null && fromLocal.length > 0) return fromLocal;
    const fromSession = sessionStorage.getItem(OFFLINE_SESSION_STORAGE_KEY);
    if (fromSession != null && fromSession.length > 0) return fromSession;
    return null;
  } catch {
    return null;
  }
}

function isNonExpired(expires: string): boolean {
  const t = new Date(expires).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Parsed snapshot only if JSON is valid, user present, and session not expired. */
export function parseValidOfflineSessionSnapshot(): OfflineSessionSnapshot | null {
  const raw = readRawSnapshot();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineSessionSnapshot>;
    if (!parsed.expires || typeof parsed.expires !== "string") return null;
    if (!parsed.user || typeof parsed.user !== "object") return null;
    if (!isNonExpired(parsed.expires)) return null;
    return {
      expires: parsed.expires,
      user: parsed.user as Session["user"],
    };
  } catch {
    return null;
  }
}

export function writeOfflineSessionSnapshot(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      expires: session.expires,
      user: session.user,
    });
    localStorage.setItem(OFFLINE_SESSION_STORAGE_KEY, payload);
    sessionStorage.setItem(OFFLINE_SESSION_STORAGE_KEY, payload);
  } catch {
    /* quota / private mode */
  }
}

export function clearOfflineSessionSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True when the device is offline and a non-expired session snapshot exists.
 * Used so the app shell can run without `/api/auth/session` (NextAuth fetch fails offline).
 */
export function readOfflineGateAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.onLine) return false;
  return parseValidOfflineSessionSnapshot() != null;
}

/** User id from a valid offline snapshot (for Dexie DB name); null if missing or expired. */
export function readOfflineUserId(): string | null {
  const snap = parseValidOfflineSessionSnapshot();
  if (!snap?.user) return null;
  const id = snap.user.id;
  return id != null && String(id).length > 0 ? String(id) : null;
}
