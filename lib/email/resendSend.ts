/**
 * Shared Resend REST helper. Requires RESEND_API_KEY and RESEND_FROM.
 * @see https://resend.com/docs
 */

export type ResendSendResult = { ok: true } | { ok: false; reason: string };

export function getResendConfig():
  | { apiKey: string; from: string }
  | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendResendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  const cfg = getResendConfig();
  if (!cfg) {
    return {
      ok: false,
      reason: "Email is not configured (RESEND_API_KEY / RESEND_FROM).",
    };
  }

  const body: Record<string, unknown> = {
    from: cfg.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };
  if (options.replyTo?.trim()) {
    body.reply_to = options.replyTo.trim();
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[resend]", res.status, text);
    return { ok: false, reason: "Failed to send email." };
  }

  return { ok: true };
}

export function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-ish block for email body (HTML-escaped). */
export function feedbackMessageHtml(message: string): string {
  return `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;margin:0">${escapeHtmlForEmail(message)}</pre>`;
}
