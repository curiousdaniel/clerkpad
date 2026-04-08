/**
 * Records that this user has been shown a persisted announcement toast (Ably or login fetch).
 * Fire-and-forget; safe to call from the client after showing the toast.
 */
export async function markGlobalAnnouncementToastsShown(
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await fetch("/api/announcements/mark-toast-shown/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}
