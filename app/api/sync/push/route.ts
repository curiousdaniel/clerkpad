import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";
import { EXPORT_VERSION } from "@/lib/services/dataPorter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json()) as {
      eventSyncId?: string;
      payload?: unknown;
      clientExportedAt?: string;
      force?: boolean;
    };

    const eventSyncId = body.eventSyncId?.trim();
    if (!eventSyncId || !UUID_RE.test(eventSyncId)) {
      return NextResponse.json(
        { error: "Valid eventSyncId (UUID) is required." },
        { status: 400 }
      );
    }
    if (body.payload == null || typeof body.payload !== "object") {
      return NextResponse.json({ error: "payload is required." }, { status: 400 });
    }
    const clientExportedAt = body.clientExportedAt?.trim();
    if (!clientExportedAt) {
      return NextResponse.json(
        { error: "clientExportedAt (ISO) is required." },
        { status: 400 }
      );
    }

    const clientTime = new Date(clientExportedAt);
    if (Number.isNaN(clientTime.getTime())) {
      return NextResponse.json(
        { error: "clientExportedAt must be a valid ISO date." },
        { status: 400 }
      );
    }

    if (!body.force) {
      const { rows: existing } = await sql<{ updated_at: Date }>`
        SELECT updated_at FROM event_cloud_snapshots
        WHERE user_id = ${userId} AND event_sync_id = ${eventSyncId}::uuid
        LIMIT 1
      `;
      const row = existing[0];
      if (row && new Date(row.updated_at) > clientTime) {
        return NextResponse.json(
          {
            error: "Conflict",
            code: "sync_conflict",
            serverUpdatedAt: new Date(row.updated_at).toISOString(),
          },
          { status: 409 }
        );
      }
    }

    const payloadJson = JSON.stringify(body.payload);

    const { rows } = await sql<{ updated_at: Date }>`
      INSERT INTO event_cloud_snapshots
        (user_id, event_sync_id, payload, payload_version, updated_at)
      VALUES
        (${userId}, ${eventSyncId}::uuid, ${payloadJson}::jsonb, ${EXPORT_VERSION}, NOW())
      ON CONFLICT (user_id, event_sync_id) DO UPDATE SET
        payload = EXCLUDED.payload,
        payload_version = EXCLUDED.payload_version,
        updated_at = NOW()
      RETURNING updated_at
    `;

    const updated = rows[0];
    return NextResponse.json({
      ok: true,
      updatedAt: updated
        ? new Date(updated.updated_at).toISOString()
        : new Date().toISOString(),
    });
  } catch (e) {
    console.error("[sync/push]", e);
    const msg = e instanceof Error ? e.message : String(e);
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
      { error: "Could not save cloud backup." },
      { status: 500 }
    );
  }
}
