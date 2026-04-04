import {
  escapeHtmlForEmail,
  sendResendEmail,
  type ResendSendResult,
} from "@/lib/email/resendSend";

function roleLabelForEmail(orgRole: string): string {
  return orgRole === "cashier" ? "Cashier" : "Clerk";
}

export async function sendOrgInviteEmail(options: {
  toEmail: string;
  inviteUrl: string;
  organizationName: string;
  inviterDisplayName: string;
  orgRole: string;
}): Promise<ResendSendResult> {
  const role = roleLabelForEmail(options.orgRole);
  const org = escapeHtmlForEmail(options.organizationName);
  const who = escapeHtmlForEmail(options.inviterDisplayName);
  const urlText = escapeHtmlForEmail(options.inviteUrl);

  return sendResendEmail({
    to: [options.toEmail],
    subject: `You’re invited to join ${options.organizationName} on ClerkBid`,
    html: `
      <p>${who} invited you to join <strong>${org}</strong> on ClerkBid as a <strong>${escapeHtmlForEmail(role)}</strong>.</p>
      <p><a href="${options.inviteUrl}">Create your account and join</a></p>
      <p>This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
      <p style="color:#666;font-size:12px">If the link does not work, copy this URL:<br>${urlText}</p>
    `.trim(),
  });
}
