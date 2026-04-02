import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/postgres";
import { hashPasswordResetToken } from "@/lib/auth/passwordResetToken";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = body.token?.trim();
    const password = body.password;
    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(token);

    const { rows } = await sql<{ id: number; user_id: number }>`
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ${tokenHash}
        AND expires_at > NOW()
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          error:
            "This reset link is invalid or has expired. Request a new one from the sign-in page.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await sql`
      UPDATE users SET password_hash = ${passwordHash} WHERE id = ${row.user_id}
    `;
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${row.user_id}`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("password_reset_tokens") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database is missing the password reset table. Run db/migrate_password_reset.sql in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not reset password. Try again." },
      { status: 500 }
    );
  }
}
