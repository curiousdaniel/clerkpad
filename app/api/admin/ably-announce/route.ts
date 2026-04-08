import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireSuperAdminNotImpersonating } from "@/lib/admin/requireSuperAdmin";
import {
  publishGlobalAnnounce,
  type GlobalAnnouncePayload,
} from "@/lib/ably/publishEventSync";
import { sql } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 120;
const MAX_BODY = 2000;

export type AnnounceDeliveryAudience = "online_now" | "persist_cross_session";

function validateAnnounceInput(body: unknown):
  | {
      ok: true;
      title?: string;
      message: string;
      severity: "info" | "warning";
      deliveryAudience: AnnounceDeliveryAudience;
      recordInMessageCenter: boolean;
    }
  | { ok: false; error: string } {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: "JSON body is required." };
  }
  const o = body as Record<string, unknown>;
  const message =
    typeof o.body === "string"
      ? o.body.trim()
      : typeof o.message === "string"
        ? o.message.trim()
        : "";
  if (!message) {
    return { ok: false, error: "body (or message) is required." };
  }
  if (message.length > MAX_BODY) {
    return { ok: false, error: `body must be at most ${MAX_BODY} characters.` };
  }
  let title: string | undefined;
  if (o.title != null) {
    if (typeof o.title !== "string") {
      return { ok: false, error: "title must be a string." };
    }
    const t = o.title.trim();
    if (t.length > MAX_TITLE) {
      return {
        ok: false,
        error: `title must be at most ${MAX_TITLE} characters.`,
      };
    }
    if (t) title = t;
  }
  const sev = o.severity;
  const severity =
    sev === "warning" ? "warning" : sev === "info" || sev == null ? "info" : null;
  if (severity == null) {
    return { ok: false, error: "severity must be info or warning." };
  }

  const da = o.deliveryAudience ?? o.delivery_audience;
  let deliveryAudience: AnnounceDeliveryAudience;
  if (da === "persist_cross_session" || da === "include_future_logins") {
    deliveryAudience = "persist_cross_session";
  } else if (da === "online_now" || da == null) {
    deliveryAudience = "online_now";
  } else {
    return {
      ok: false,
      error:
        "deliveryAudience must be online_now or persist_cross_session (include_future_logins).",
    };
  }

  const rec = o.recordInMessageCenter ?? o.record_in_message_center;
  const recordInMessageCenter =
    rec === false || rec === "false" ? false : true;

  return {
    ok: true,
    title,
    message,
    severity,
    deliveryAudience,
    recordInMessageCenter,
  };
}

export async function POST(req: Request) {
  const session = await requireSuperAdminNotImpersonating();
  if (session instanceof NextResponse) return session;

  const ablyConfigured = Boolean(process.env.ABLY_API_KEY?.trim());

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = validateAnnounceInput(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const {
    message,
    title,
    severity,
    deliveryAudience,
    recordInMessageCenter,
  } = parsed;

  const needsDbInsert =
    deliveryAudience === "persist_cross_session" ||
    (deliveryAudience === "online_now" && recordInMessageCenter);

  const id = randomUUID();
  const issuedAt = new Date();
  const createdByUserId = parseInt(session.user.id ?? "", 10);
  const actorId = Number.isFinite(createdByUserId) ? createdByUserId : null;

  if (needsDbInsert) {
    try {
      await sql`
        INSERT INTO global_announcements (
          id,
          title,
          body,
          severity,
          issued_at,
          delivery_audience,
          visible_in_message_center,
          created_by_user_id
        )
        VALUES (
          ${id}::uuid,
          ${title ?? null},
          ${message},
          ${severity},
          ${issuedAt.toISOString()}::timestamptz,
          ${deliveryAudience},
          ${recordInMessageCenter},
          ${actorId}
        )
      `;
    } catch (e) {
      console.error("[admin/ably-announce] insert", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("global_announcements") &&
        msg.includes("does not exist")
      ) {
        return NextResponse.json(
          {
            error:
              "Database migration missing. Run db/migrate_global_announcements.sql on your database.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Could not save announcement." },
        { status: 500 }
      );
    }
  }

  if (!ablyConfigured) {
    if (deliveryAudience === "online_now" && !needsDbInsert) {
      return NextResponse.json(
        {
          error:
            "ABLY_API_KEY is required for online-only announcements that are not saved. Enable Ably or turn on “Save to message center”.",
        },
        { status: 503 }
      );
    }
  }

  const payload: GlobalAnnouncePayload = {
    id,
    body: message,
    severity,
    issuedAt: issuedAt.getTime(),
  };
  if (title) payload.title = title;
  if (deliveryAudience === "persist_cross_session") {
    payload.persistedForLogin = true;
  }

  if (ablyConfigured) {
    publishGlobalAnnounce(payload);
  }

  return NextResponse.json({
    ok: true,
    id,
    deliveryAudience,
    recordInMessageCenter,
    ablyPublished: ablyConfigured,
  });
}
