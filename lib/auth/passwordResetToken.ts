import { createHash, randomBytes } from "crypto";

/** Opaque token for the URL; only the hash is stored in the database. */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
