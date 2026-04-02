import {
  escapeHtmlForEmail,
  feedbackMessageHtml,
  sendResendEmail,
} from "@/lib/email/resendSend";

const DEFAULT_TO = "info@auctionmethod.com";

export async function sendFeedbackEmail(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const to = process.env.FEEDBACK_TO_EMAIL?.trim() || DEFAULT_TO;
  const displayName = payload.name.trim() || "—";

  const html = `
    <p><strong>ClerkBid feedback</strong></p>
    <p>Name: ${escapeHtmlForEmail(displayName)}<br/>
    Email: ${escapeHtmlForEmail(payload.email)}</p>
    ${feedbackMessageHtml(payload.message)}
  `.trim();

  return sendResendEmail({
    to: [to],
    subject: `[ClerkBid] Feedback from ${payload.email}`,
    html,
    replyTo: payload.email,
  });
}
