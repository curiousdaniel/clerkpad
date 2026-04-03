import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import { requireSuperAdminNotImpersonating } from "@/lib/admin/requireSuperAdmin";
import { isSuperAdminUserIdAndEmail } from "@/lib/auth/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireSuperAdminNotImpersonating();
  if (session instanceof NextResponse) return session;

  const adminId = parseInt(session.user.id, 10);
  if (!Number.isFinite(adminId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  let body: { userId?: number };
  try {
    body = (await req.json()) as { userId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const targetId = body.userId;
  if (
    targetId == null ||
    typeof targetId !== "number" ||
    !Number.isFinite(targetId) ||
    targetId < 1
  ) {
    return NextResponse.json(
      { error: "userId (positive number) is required." },
      { status: 400 }
    );
  }

  if (targetId === adminId) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  try {
    const { rows: targetRows } = await sql<{
      id: number;
      email: string;
      vendor_id: number;
    }>`
      SELECT id, email, vendor_id FROM users WHERE id = ${targetId} LIMIT 1
    `;
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (isSuperAdminUserIdAndEmail(target.id, target.email)) {
      return NextResponse.json(
        { error: "Super-admin accounts cannot be deleted from this panel." },
        { status: 403 }
      );
    }

    const vendorId = target.vendor_id;

    await sql`DELETE FROM users WHERE id = ${targetId}`;

    const { rows: remaining } = await sql<{ n: string }>`
      SELECT COUNT(*)::text AS n FROM users WHERE vendor_id = ${vendorId}
    `;
    if (remaining[0]?.n === "0") {
      await sql`DELETE FROM vendors WHERE id = ${vendorId}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[admin/delete-user]", e);
    return NextResponse.json(
      { error: "Could not delete user." },
      { status: 500 }
    );
  }
}
