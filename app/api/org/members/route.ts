import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";
import { parseSessionVendorId } from "@/lib/auth/sessionVendor";
import { isOrgAdmin } from "@/lib/auth/orgRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const vendorId = parseSessionVendorId(session);
    if (vendorId == null) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { rows: members } = await sql<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      org_role: string;
    }>`
      SELECT id, email, first_name, last_name, COALESCE(org_role, 'admin') AS org_role
      FROM users
      WHERE vendor_id = ${vendorId}
      ORDER BY id ASC
    `;

    let pendingInvites: {
      id: number;
      email: string;
      orgRole: string;
      expiresAt: string;
      createdAt: string;
    }[] = [];

    if (isOrgAdmin(session?.user?.orgRole)) {
      const { rows: invites } = await sql<{
        id: number;
        email: string;
        org_role: string;
        expires_at: Date;
        created_at: Date;
      }>`
        SELECT id, email, org_role, expires_at, created_at
        FROM vendor_invites
        WHERE vendor_id = ${vendorId}
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
      `;
      pendingInvites = invites.map((i) => ({
        id: i.id,
        email: i.email,
        orgRole: i.org_role,
        expiresAt: new Date(i.expires_at).toISOString(),
        createdAt: new Date(i.created_at).toISOString(),
      }));
    }

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        firstName: m.first_name,
        lastName: m.last_name,
        orgRole: m.org_role,
      })),
      pendingInvites,
    });
  } catch (e) {
    console.error("[org/members]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("org_role") || msg.includes("vendor_invites")) {
      return NextResponse.json(
        {
          error:
            "Database needs migration for team features. Run db/migrate_multi_user_org.sql in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not load team." },
      { status: 500 }
    );
  }
}
