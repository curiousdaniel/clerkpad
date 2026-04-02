/**
 * Shared Resend REST helper. Requires RESEND_API_KEY and RESEND_FROM.
 * RESEND_FROM must use a domain verified at https://resend.com/domains
 * @see https://resend.com/docs
 */

export type ResendErrorCode =
  | "missing_config"
  | "domain_not_verified"
  | "resend_error";

export type ResendSendResult =
  | { ok: true }
  | { ok: false; reason: string; code: ResendErrorCode };

export function getResendConfig():
  | { apiKey: string; from: string }
  | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

function classifyResendHttpError(
  status: number,
  bodyText: string
): { reason: string; code: Exclude<ResendErrorCode, "missing_config"> } {
  let apiMessage = bodyText;
  try {
    const j = JSON.parse(bodyText) as { message?: string };
    if (typeof j.message === "string") apiMessage = j.message;
  } catch {
    /* use raw body */
  }

  console.error("[resend]", status, apiMessage);

  const domainIssue =
    status === 403 &&
    /not verified|verify your domain|domain is not verified/i.test(
      apiMessage
    );

  if (domainIssue) {
    return {
      reason: "Resend rejected the send: sending domain is not verified.",
      code: "domain_not_verified",
    };
  }

  return {
    reason: `Resend API error (${status}).`,
    code: "resend_error",
  };
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
      code: "missing_config",
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
    const { reason, code } = classifyResendHttpError(res.status, text);
    return { ok: false, reason, code };
  }

  return { ok: true };
}

export async function sendResendEmailWithAttachments(options: {
  to: string[];
  subject: string;
  html: string;
  attachments: { filename: string; contentBase64: string }[];
}): Promise<ResendSendResult> {
  const cfg = getResendConfig();
  if (!cfg) {
    return {
      ok: false,
      reason: "Email is not configured (RESEND_API_KEY / RESEND_FROM).",
      code: "missing_config",
    };
  }

  const body: Record<string, unknown> = {
    from: cfg.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments.map((a) => ({
      filename: a.filename,
      content: a.contentBase64,
    })),
  };

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
    const { reason, code } = classifyResendHttpError(res.status, text);
    return { ok: false, reason, code };
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
