import {
  escapeHtmlForEmail,
  feedbackMessageHtml,
  sendResendEmail,
  type ResendSendResult,
} from "@/lib/email/resendSend";

const DEFAULT_TO = "info@auctionmethod.com";

/** RFC-style Reply-To: optional display name plus angle-addr (avoids odd characters in the name part). */
function feedbackReplyToHeader(name: string, email: string): string {
  const n = name.trim();
  if (!n || n === "—" || /[\r\n"<>]/.test(n)) {
    return email;
  }
  return `${n} <${email}>`;
}

export async function sendFeedbackEmail(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<ResendSendResult> {
  const to = process.env.FEEDBACK_TO_EMAIL?.trim() || DEFAULT_TO;
  const displayName = payload.name.trim() || "—";
  const replyTo = feedbackReplyToHeader(payload.name, payload.email);

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
    replyTo,
  });
}
