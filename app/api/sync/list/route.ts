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
    const vendorId = parseInt(session.user.vendorId, 10);
    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { rows } = await sql<{
      event_sync_id: string;
      updated_at: Date;
    }>`
      SELECT event_sync_id::text AS event_sync_id, updated_at
      FROM event_cloud_snapshots
      WHERE vendor_id = ${vendorId}
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({
      events: rows.map((r) => ({
        eventSyncId: r.event_sync_id,
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
    });
  } catch (e) {
    console.error("[sync/list]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("vendor_id")) {
      return NextResponse.json(
        {
          error:
            "Database needs migration for shared organization backups. Run db/migrate_multi_user_org.sql in Neon.",
        },
        { status: 503 }
      );
    }
    if (msg.includes("event_cloud_snapshots") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database is missing cloud sync tables. Run db/migrate_cloud_sync.sql in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not list backups." },
      { status: 500 }
    );
  }
}
