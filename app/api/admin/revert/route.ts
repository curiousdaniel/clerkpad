import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import {
  generateImpersonationSecret,
  hashImpersonationToken,
} from "@/lib/admin/impersonationToken";
import { requireImpersonationSession } from "@/lib/admin/requireSuperAdmin";
import { isSuperAdminUserIdAndEmail } from "@/lib/auth/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function POST() {
  const session = await requireImpersonationSession();
  if (session instanceof NextResponse) return session;

  const adminId = parseInt(session.impersonatedByUserId ?? "", 10);
  const subjectId = parseInt(session.user.id, 10);
  if (!Number.isFinite(adminId) || adminId < 1) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  try {
    const { rows: adminRows } = await sql<{ id: number; email: string }>`
      SELECT id, email FROM users WHERE id = ${adminId} LIMIT 1
    `;
    const adminUser = adminRows[0];
    if (
      !adminUser ||
      !isSuperAdminUserIdAndEmail(adminUser.id, adminUser.email)
    ) {
      return NextResponse.json(
        { error: "Invalid impersonation state." },
        { status: 403 }
      );
    }

    const plaintext = generateImpersonationSecret();
    const tokenHash = hashImpersonationToken(plaintext);
    const expiresAt = new Date(Date.now() + TTL_MS);

    await sql`
      INSERT INTO admin_impersonation_tokens
        (token_hash, created_by_user_id, subject_user_id, expires_at)
      VALUES
        (${tokenHash}, ${subjectId}, ${adminId}, ${expiresAt.toISOString()}::timestamptz)
    `;

    return NextResponse.json({
      impersonationToken: plaintext,
      expiresInSeconds: Math.floor(TTL_MS / 1000),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("admin_impersonation_tokens") &&
      msg.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error:
            "Admin impersonation is not set up. Run db/migrate_admin_impersonation.sql in Neon.",
        },
        { status: 503 }
      );
    }
    console.error("[admin/revert]", e);
    return NextResponse.json(
      { error: "Could not create revert token." },
      { status: 500 }
    );
  }
}
