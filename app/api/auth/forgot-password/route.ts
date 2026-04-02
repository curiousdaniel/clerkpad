import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/auth/passwordResetToken";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";

export const runtime = "nodejs";

const PUBLIC_MESSAGE =
  "If an account exists for that email, you will receive password reset instructions shortly.";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const { rows } = await sql<{ id: number }>`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ ok: true, message: PUBLIC_MESSAGE });
    }

    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;

    const plainToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `;

    if (process.env.NODE_ENV === "development") {
      const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
      console.info(
        "[dev] Password reset link:",
        `${base}/reset-password/?token=${plainToken}`
      );
    }

    const sent = await sendPasswordResetEmail(email, plainToken);
    if (!sent.ok) {
      await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
      console.error("[forgot-password]", sent.reason);
      return NextResponse.json(
        {
          error:
            "Password reset email could not be sent. Ask your administrator to configure email (Resend), or try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, message: PUBLIC_MESSAGE });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("password_reset_tokens") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database is missing the password reset table. Run db/migrate_password_reset.sql (or full db/schema.sql) in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Try again later." },
      { status: 500 }
    );
  }
}
