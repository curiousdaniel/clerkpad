import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import { hashInviteToken } from "@/lib/auth/inviteToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "token query parameter is required." },
        { status: 400 }
      );
    }

    const tokenHash = hashInviteToken(token);
    const { rows } = await sql<{
      email: string;
      expires_at: Date;
      consumed_at: Date | null;
      vendor_name: string;
      org_role: string;
    }>`
      SELECT vi.email, vi.expires_at, vi.consumed_at, vi.org_role, v.name AS vendor_name
      FROM vendor_invites vi
      INNER JOIN vendors v ON v.id = vi.vendor_id
      WHERE vi.token_hash = ${tokenHash}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Invalid or expired invite." }, { status: 404 });
    }
    if (row.consumed_at != null) {
      return NextResponse.json({ error: "This invite was already used." }, { status: 410 });
    }
    if (new Date(row.expires_at) <= new Date()) {
      return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
    }

    return NextResponse.json({
      ok: true as const,
      organizationName: row.vendor_name,
      email: row.email,
      orgRole: row.org_role,
      expiresAt: new Date(row.expires_at).toISOString(),
    });
  } catch (e) {
    console.error("[invite/validate]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("vendor_invites") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Invites are not set up. Run db/migrate_multi_user_org.sql in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not validate invite." },
      { status: 500 }
    );
  }
}
