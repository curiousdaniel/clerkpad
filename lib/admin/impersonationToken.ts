import { createHash, randomBytes } from "crypto";

export function generateImpersonationSecret(): string {
  return randomBytes(32).toString("hex");
}

export function hashImpersonationToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
