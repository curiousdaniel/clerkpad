import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireSuperAdminNotImpersonating } from "@/lib/admin/requireSuperAdmin";
import {
  publishGlobalAnnounce,
  type GlobalAnnouncePayload,
} from "@/lib/ably/publishEventSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 120;
const MAX_BODY = 2000;

function validateAnnounceInput(body: unknown): {
  ok: true;
  title?: string;
  message: string;
  severity: "info" | "warning";
} | { ok: false; error: string } {
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
  return { ok: true, title, message, severity };
}

export async function POST(req: Request) {
  const session = await requireSuperAdminNotImpersonating();
  if (session instanceof NextResponse) return session;

  if (!process.env.ABLY_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Ably is not configured (ABLY_API_KEY)." },
      { status: 503 }
    );
  }

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

  const payload: GlobalAnnouncePayload = {
    id: randomUUID(),
    body: parsed.message,
    severity: parsed.severity,
    issuedAt: Date.now(),
  };
  if (parsed.title) payload.title = parsed.title;

  publishGlobalAnnounce(payload);
  return NextResponse.json({ ok: true, id: payload.id });
}
