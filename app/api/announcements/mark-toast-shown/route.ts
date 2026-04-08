import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";

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

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    const o = json as { ids?: unknown };
    if (!Array.isArray(o.ids)) {
      return NextResponse.json({ error: "ids array is required." }, { status: 400 });
    }
    const ids = o.ids.filter(
      (x): x is string => typeof x === "string" && UUID_RE.test(x.trim())
    );
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, marked: 0 });
    }

    for (const raw of ids) {
      const id = raw.trim();
      const check = await sql<{ ok: number }>`
        SELECT 1 AS ok FROM global_announcements
        WHERE id = ${id}::uuid AND delivery_audience = 'persist_cross_session'
        LIMIT 1
      `;
      if (!check.rows[0]) continue;
      await sql`
        INSERT INTO user_announcement_toasts_shown (user_id, announcement_id)
        VALUES (${userId}, ${id}::uuid)
        ON CONFLICT (user_id, announcement_id) DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true, marked: ids.length });
  } catch (e) {
    console.error("[announcements/mark-toast-shown POST]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("global_announcements") &&
      msg.includes("does not exist")
    ) {
      return NextResponse.json({ ok: true, marked: 0 });
    }
    return NextResponse.json(
      { error: "Could not record delivery." },
      { status: 500 }
    );
  }
}
