/**
 * NextAuth requires a secret in production. Middleware also accepts AUTH_SECRET.
 * Set at least one in Vercel (all environments): openssl rand -base64 32
 */
export function resolveAuthSecret(): string | undefined {
  const s =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  return s || undefined;
}
