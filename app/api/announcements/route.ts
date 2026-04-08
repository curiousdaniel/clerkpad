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

    const { rows } = await sql<{
      id: string;
      title: string | null;
      body: string;
      severity: string;
      issued_at: Date;
      delivery_audience: string;
    }>`
      SELECT id::text, title, body, severity, issued_at, delivery_audience
      FROM global_announcements
      WHERE visible_in_message_center = true
      ORDER BY issued_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      announcements: rows.map((r) => ({
        id: r.id,
        title: r.title ?? undefined,
        body: r.body,
        severity: r.severity === "warning" ? "warning" : "info",
        issuedAt: new Date(r.issued_at).toISOString(),
        deliveryAudience: r.delivery_audience,
      })),
    });
  } catch (e) {
    console.error("[announcements GET]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("global_announcements") &&
      msg.includes("does not exist")
    ) {
      return NextResponse.json({ announcements: [] });
    }
    return NextResponse.json(
      { error: "Could not load announcements." },
      { status: 500 }
    );
  }
}
