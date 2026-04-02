/**
 * Sends password reset email via Resend (https://resend.com).
 * Set RESEND_API_KEY and RESEND_FROM (see .env.example / Vercel env).
 */

import {
  sendResendEmail,
  type ResendSendResult,
} from "@/lib/email/resendSend";

function baseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function sendPasswordResetEmail(
  toEmail: string,
  plainToken: string
): Promise<ResendSendResult> {
  const resetUrl = `${baseUrl()}/reset-password/?token=${encodeURIComponent(plainToken)}`;

  return sendResendEmail({
    to: [toEmail],
    subject: "Reset your ClerkBid password",
    html: `
        <p>You asked to reset your ClerkBid password.</p>
        <p><a href="${resetUrl}">Set a new password</a></p>
        <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>
        <p style="color:#666;font-size:12px">If the button does not work, copy this URL:<br>${resetUrl}</p>
      `.trim(),
  });
}
