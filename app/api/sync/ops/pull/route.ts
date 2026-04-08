import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";

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

export async function GET(req: Request) {
  try {
    if (!opsEnabled()) {
      return NextResponse.json({ error: "Op sync disabled." }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const vendorId = parseInt(session.user.vendorId, 10);
    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventSyncId = searchParams.get("eventSyncId")?.trim();
    if (!eventSyncId || !UUID_RE.test(eventSyncId)) {
      return NextResponse.json(
        { error: "Valid eventSyncId (UUID) is required." },
        { status: 400 }
      );
    }
    const afterRaw = searchParams.get("afterId")?.trim() ?? "0";
    const afterId = /^\d+$/.test(afterRaw) ? afterRaw : "0";
    const limitRaw = parseInt(searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, limitRaw))
      : 100;

    type Row = {
      id: string;
      op_id: string;
      op_type: string;
      payload: unknown;
      client_created_at: Date;
    };

    let rows: Row[];
    try {
      const res = await sql<Row>`
        SELECT id::text, op_id::text, op_type, payload, client_created_at
        FROM event_sync_ops
        WHERE vendor_id = ${vendorId}
          AND event_sync_id = ${eventSyncId}::uuid
          AND id > ${afterId}::bigint
        ORDER BY id ASC
        LIMIT ${limit}
      `;
      rows = res.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("event_sync_ops") || msg.includes("does not exist")) {
        return NextResponse.json(
          { error: "Op sync tables missing." },
          { status: 503 }
        );
      }
      throw e;
    }

    const ops = rows.map((r) => ({
      id: r.id,
      opId: r.op_id,
      opType: r.op_type,
      payload: r.payload,
      clientCreatedAt: new Date(r.client_created_at).toISOString(),
    }));

    return NextResponse.json({ ops });
  } catch (e) {
    console.error("sync ops pull", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
