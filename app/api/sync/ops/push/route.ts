import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";
import { SYNC_OP_TYPES } from "@/lib/sync/ops/types";
import { publishEventSyncNudge } from "@/lib/ably/publishEventSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function opsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SYNC_OPS === "1" ||
    process.env.NEXT_PUBLIC_SYNC_OPS === "true" ||
    process.env.SYNC_OPS === "1" ||
    process.env.SYNC_OPS === "true"
  );
}

export async function POST(req: Request) {
  try {
    if (!opsEnabled()) {
      return NextResponse.json({ error: "Op sync disabled." }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    const vendorId = parseInt(session.user.vendorId, 10);
    if (!Number.isFinite(userId) || !Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json()) as {
      eventSyncId?: string;
      ops?: Array<{
        opId?: string;
        eventSyncId?: string;
        opType?: string;
        clientCreatedAt?: string;
        body?: unknown;
      }>;
    };

    const eventSyncId = body.eventSyncId?.trim();
    if (!eventSyncId || !UUID_RE.test(eventSyncId)) {
      return NextResponse.json(
        { error: "Valid eventSyncId (UUID) is required." },
        { status: 400 }
      );
    }
    const ops = Array.isArray(body.ops) ? body.ops : [];
    if (ops.length === 0) {
      return NextResponse.json({ acceptedOpIds: [] });
    }
    if (ops.length > 200) {
      return NextResponse.json({ error: "Too many ops in one request." }, { status: 400 });
    }

    const allowed = new Set<string>(SYNC_OP_TYPES);
    const acceptedOpIds: string[] = [];

    for (const op of ops) {
      const opId = op.opId?.trim();
      const ev = op.eventSyncId?.trim();
      const opType = op.opType?.trim();
      const clientCreatedAt = op.clientCreatedAt?.trim();
      if (!opId || !UUID_RE.test(opId)) continue;
      if (ev !== eventSyncId) continue;
      if (!opType || !allowed.has(opType)) continue;
      if (!clientCreatedAt) continue;
      const clientTs = new Date(clientCreatedAt);
      if (Number.isNaN(clientTs.getTime())) continue;

      const payloadJson = JSON.stringify(op.body ?? {});
      try {
        const ins = await sql<{ op_id: string }>`
          INSERT INTO event_sync_ops
            (vendor_id, event_sync_id, op_id, actor_user_id, op_type, payload, client_created_at)
          VALUES
            (${vendorId}, ${eventSyncId}::uuid, ${opId}::uuid, ${userId}, ${opType}, ${payloadJson}::jsonb, ${clientTs.toISOString()}::timestamptz)
          ON CONFLICT (op_id) DO NOTHING
          RETURNING op_id::text AS op_id
        `;
        if (ins.rows[0]?.op_id) {
          acceptedOpIds.push(opId);
        } else {
          const ex = await sql<{ ok: number }>`
            SELECT 1 AS ok FROM event_sync_ops
            WHERE vendor_id = ${vendorId} AND op_id = ${opId}::uuid
            LIMIT 1
          `;
          if (ex.rows[0]) acceptedOpIds.push(opId);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("event_sync_ops") || msg.includes("does not exist")) {
          return NextResponse.json(
            { error: "Op sync tables missing. Run db/migrate_event_sync_ops.sql." },
            { status: 503 }
          );
        }
        throw e;
      }
    }

    if (acceptedOpIds.length > 0) {
      publishEventSyncNudge(vendorId, eventSyncId);
    }

    return NextResponse.json({ acceptedOpIds });
  } catch (e) {
    console.error("sync ops push", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
