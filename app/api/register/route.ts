import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db/postgres";
import { slugifyOrgName } from "@/lib/auth/slug";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      organizationName?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();
    const organizationName = body.organizationName?.trim();

    if (!email || !password || !organizationName) {
      return NextResponse.json(
        { error: "Email, password, and organization name are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let baseSlug = slugifyOrgName(organizationName);
    let slug = baseSlug;
    let vendorId: number | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const { rows } = await sql<{ id: number }>`
          INSERT INTO vendors (name, slug)
          VALUES (${organizationName}, ${slug})
          RETURNING id
        `;
        vendorId = rows[0]?.id ?? null;
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("unique") || msg.includes("duplicate")) {
          slug = `${baseSlug}-${attempt + 1}`;
          continue;
        }
        throw e;
      }
    }

    if (vendorId == null) {
      return NextResponse.json(
        { error: "Could not create organization. Try a different name." },
        { status: 409 }
      );
    }

    try {
      await sql`
        INSERT INTO users (email, password_hash, name, vendor_id)
        VALUES (${email}, ${passwordHash}, ${name || null}, ${vendorId})
      `;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`DELETE FROM vendors WHERE id = ${vendorId}`;
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Registration failed. Check database configuration." },
      { status: 500 }
    );
  }
}
