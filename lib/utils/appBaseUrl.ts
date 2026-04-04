/**
 * Canonical public origin for links in emails and server-built URLs.
 * Prefer NEXTAUTH_URL; on Vercel, VERCEL_URL is set automatically (no scheme).
 */
export function getAppBaseUrl(): string {
  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}
