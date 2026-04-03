import { createHash, randomBytes } from "crypto";

/** URL-safe token for invite links; store only SHA-256 hash server-side. */
export function generateInviteSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
