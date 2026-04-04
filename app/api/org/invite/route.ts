import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { sql } from "@/lib/db/postgres";
import {
  parseSessionUserId,
  parseSessionVendorId,
} from "@/lib/auth/sessionVendor";
import {
  generateInviteSecret,
  hashInviteToken,
} from "@/lib/auth/inviteToken";
import { parseOrgRole, type OrgRole, isOrgAdmin } from "@/lib/auth/orgRole";
import { sendOrgInviteEmail } from "@/lib/email/sendOrgInviteEmail";
import { getAppBaseUrl } from "@/lib/utils/appBaseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const vendorId = parseSessionVendorId(session);
    const userId = parseSessionUserId(session);
    if (vendorId == null || userId == null) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isOrgAdmin(session?.user?.orgRole)) {
      return NextResponse.json(
        { error: "Only organization admins can send invites." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      email?: string;
      orgRole?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const roleParsed = parseOrgRole(body.orgRole ?? "clerk");
    const orgRole: OrgRole = roleParsed ?? "clerk";
    if (orgRole === "admin") {
      return NextResponse.json(
        { error: "Invited users cannot be given the admin role." },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const { rows: existingUser } = await sql<{ id: number }>`
      SELECT id FROM users WHERE vendor_id = ${vendorId} AND lower(email) = ${email} LIMIT 1
    `;
    if (existingUser[0]) {
      return NextResponse.json(
        { error: "Someone with this email is already in your organization." },
        { status: 409 }
      );
    }

    await sql`
      DELETE FROM vendor_invites
      WHERE vendor_id = ${vendorId}
        AND lower(email) = ${email}
        AND consumed_at IS NULL
    `;

    const plaintext = generateInviteSecret();
    const tokenHash = hashInviteToken(plaintext);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const expiresAtIso = expiresAt.toISOString();

    await sql`
      INSERT INTO vendor_invites
        (vendor_id, email, org_role, token_hash, expires_at, created_by_user_id)
      VALUES
        (${vendorId}, ${email}, ${orgRole}, ${tokenHash}, ${expiresAtIso}, ${userId})
    `;

    const joinPath = `/register/join/?token=${encodeURIComponent(plaintext)}`;
    const inviteUrl = `${getAppBaseUrl()}${joinPath}`;

    const { rows: ctxRows } = await sql<{
      vendor_name: string;
      first_name: string;
      last_name: string;
    }>`
      SELECT v.name AS vendor_name, u.first_name, u.last_name
      FROM vendors v
      INNER JOIN users u ON u.id = ${userId} AND u.vendor_id = v.id
      WHERE v.id = ${vendorId}
      LIMIT 1
    `;
    const ctx = ctxRows[0];
    const organizationName = ctx?.vendor_name?.trim() || "your organization";
    const inviterDisplay =
      `${ctx?.first_name ?? ""} ${ctx?.last_name ?? ""}`.trim() ||
      session?.user?.email?.trim() ||
      "An administrator";

    const emailResult = await sendOrgInviteEmail({
      toEmail: email,
      inviteUrl,
      organizationName,
      inviterDisplayName: inviterDisplay,
      orgRole,
    });

    return NextResponse.json({
      ok: true as const,
      invitePath: joinPath,
      inviteUrl,
      orgRole,
      email,
      expiresAt: expiresAt.toISOString(),
      emailSent: emailResult.ok,
      ...(emailResult.ok
        ? {}
        : { emailSendError: emailResult.reason }),
    });
  } catch (e) {
    console.error("[org/invite]", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("vendor_invites") || msg.includes("org_role")) {
      return NextResponse.json(
        {
          error:
            "Database needs migration for team invites. Run db/migrate_multi_user_org.sql in Neon.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Could not create invite." },
      { status: 500 }
    );
  }
}
