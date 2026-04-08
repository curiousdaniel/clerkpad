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

    const { rows } = await sql<{
      id: string;
      title: string | null;
      body: string;
      severity: string;
      issued_at: Date;
    }>`
      SELECT a.id::text, a.title, a.body, a.severity, a.issued_at
      FROM global_announcements a
      LEFT JOIN user_announcement_toasts_shown u
        ON u.announcement_id = a.id AND u.user_id = ${userId}
      WHERE a.delivery_audience = 'persist_cross_session'
        AND u.user_id IS NULL
      ORDER BY a.issued_at ASC
      LIMIT 20
    `;

    return NextResponse.json({
      announcements: rows.map((r) => ({
        id: r.id,
        title: r.title ?? undefined,
        body: r.body,
        severity: r.severity === "warning" ? "warning" : "info",
        issuedAt: new Date(r.issued_at).toISOString(),
        persistedForLogin: true as const,
      })),
    });
  } catch (e) {
    console.error("[announcements/pending-login GET]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("global_announcements") &&
      msg.includes("does not exist")
    ) {
      return NextResponse.json({ announcements: [] });
    }
    return NextResponse.json(
      { error: "Could not load pending announcements." },
      { status: 500 }
    );
  }
}
