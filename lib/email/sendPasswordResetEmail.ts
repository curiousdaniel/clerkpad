/**
 * Sends password reset email via Resend (https://resend.com).
 * Set RESEND_API_KEY and RESEND_FROM in production (RESEND_FROM must be a verified sender).
 */

function baseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function sendPasswordResetEmail(
  toEmail: string,
  plainToken: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, reason: "Email is not configured (RESEND_API_KEY / RESEND_FROM)." };
  }

  const resetUrl = `${baseUrl()}/reset-password/?token=${encodeURIComponent(plainToken)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: "Reset your ClerkBid password",
      html: `
        <p>You asked to reset your ClerkBid password.</p>
        <p><a href="${resetUrl}">Set a new password</a></p>
        <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>
        <p style="color:#666;font-size:12px">If the button does not work, copy this URL:<br>${resetUrl}</p>
      `.trim(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[password reset email]", res.status, text);
    return { ok: false, reason: "Failed to send email." };
  }

  return { ok: true };
}
