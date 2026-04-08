const SEEN_KEY_PREFIX = "clerkbid_announce_seen:";

type AnnounceToast = {
  message: string;
  kind?: "success" | "error" | "info" | "warning";
  durationMs?: number;
};

function isAnnouncePayload(data: unknown): data is {
  id: string;
  body: string;
  severity?: string;
  title?: string;
} {
  if (data == null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.trim().length > 0 &&
    typeof o.body === "string" &&
    o.body.trim().length > 0
  );
}

/**
 * Show one toast per announcement id; dedupe across tabs/reconnects via sessionStorage.
 */
export function handleAblyAnnounceMessage(
  data: unknown,
  showToast: (t: AnnounceToast) => void
): void {
  if (!isAnnouncePayload(data)) return;
  const id = data.id.trim();
  const body = data.body.trim();
  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(SEEN_KEY_PREFIX + id)) return;
      sessionStorage.setItem(SEEN_KEY_PREFIX + id, "1");
    }
  } catch {
    // private mode — still show once per page load
  }
  const title =
    typeof data.title === "string" ? data.title.trim() : "";
  const message = title ? `${title}\n\n${body}` : body;
  const severity = data.severity === "warning" ? "warning" : "info";
  showToast({
    message,
    kind: severity,
    durationMs: severity === "warning" ? 14_000 : 10_000,
  });
}
