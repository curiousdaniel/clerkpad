import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { rows } = await sql<{ monthly_backup_email: boolean }>`
      SELECT monthly_backup_email
      FROM user_sync_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    return NextResponse.json({
      monthlyBackupEmail: row?.monthly_backup_email ?? false,
    });
  } catch (e) {
    console.error("[sync/preferences GET]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("user_sync_preferences") || msg.includes("does not exist")) {
      return NextResponse.json({ monthlyBackupEmail: false });
    }
    return NextResponse.json(
      { error: "Could not load preferences." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json()) as { monthlyBackupEmail?: boolean };
    const monthlyBackupEmail = body.monthlyBackupEmail === true;

    await sql`
      INSERT INTO user_sync_preferences (user_id, monthly_backup_email, updated_at)
      VALUES (${userId}, ${monthlyBackupEmail}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        monthly_backup_email = EXCLUDED.monthly_backup_email,
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true, monthlyBackupEmail });
  } catch (e) {
    console.error("[sync/preferences PATCH]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("user_sync_preferences") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database is missing user_sync_preferences. Run db/migrate_cloud_sync.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not save preference." },
      { status: 500 }
    );
  }
}
