import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";
import {
  publishEventSyncNudge,
  sanitizeSyncScope,
} from "@/lib/ably/publishEventSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function vendorOwnsEventSync(
  vendorId: number,
  eventSyncId: string
): Promise<boolean> {
  const snap = await sql<{ ok: number }>`
    SELECT 1 AS ok FROM event_cloud_snapshots
    WHERE vendor_id = ${vendorId} AND event_sync_id = ${eventSyncId}::uuid
    LIMIT 1
  `;
  if (snap.rows[0]) return true;
  const ops = await sql<{ ok: number }>`
    SELECT 1 AS ok FROM event_sync_ops
    WHERE vendor_id = ${vendorId} AND event_sync_id = ${eventSyncId}::uuid
    LIMIT 1
  `;
  return !!ops.rows[0];
}

/**
 * Authenticated clients call this after local CRUD so teammates get an Ably
 * nudge before debounced snapshot push lands (same channel as server pushes).
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const vendorId = parseInt(session.user.vendorId, 10);
    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json()) as {
      eventSyncId?: string;
      scope?: string;
    };
    const eventSyncId = body.eventSyncId?.trim() ?? "";
    if (!eventSyncId || !UUID_RE.test(eventSyncId)) {
      return NextResponse.json(
        { error: "Valid eventSyncId (UUID) is required." },
        { status: 400 }
      );
    }

    const owns = await vendorOwnsEventSync(vendorId, eventSyncId);
    if (!owns) {
      return NextResponse.json(
        {
          error:
            "This event is not on the server yet for your organization. Sync once, then realtime nudges are available.",
        },
        { status: 403 }
      );
    }

    const scope = sanitizeSyncScope(body.scope);
    publishEventSyncNudge(vendorId, eventSyncId, scope ? { scope } : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ably/publish-event-nudge]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("event_cloud_snapshots") || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Cloud sync is not configured on this server." },
        { status: 503 }
      );
    }
    if (msg.includes("event_sync_ops")) {
      return NextResponse.json(
        { error: "Op sync tables may be missing." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not publish." }, { status: 500 });
  }
}
