/** Used for company matching; extend as needed. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
]);

/**
 * Lowercase domain from email, or null if missing / invalid.
 */
export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).replace(/^[\s<>]+|[\s>]+$/g, "");
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

export function isConsumerEmailDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}
