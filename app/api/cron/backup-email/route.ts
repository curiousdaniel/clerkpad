import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import { sendResendEmailWithAttachments } from "@/lib/email/resendSend";
import { APP_VERSION } from "@/lib/utils/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { rows: users } = await sql<{ id: number; email: string }>`
      SELECT u.id, u.email
      FROM users u
      INNER JOIN user_sync_preferences p ON p.user_id = u.id
      WHERE p.monthly_backup_email = true
    `;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const u of users) {
      const { rows: snaps } = await sql<{ payload: unknown }>`
        SELECT payload
        FROM event_cloud_snapshots
        WHERE user_id = ${u.id}
        ORDER BY updated_at DESC
      `;

      if (snaps.length === 0) {
        skipped++;
        continue;
      }

      const events = snaps.map((s) => s.payload);
      const bundle = {
        fullExportVersion: 1,
        exportDate: new Date().toISOString(),
        appVersion: APP_VERSION,
        events,
      };
      const json = JSON.stringify(bundle);
      const buf = Buffer.from(json, "utf8");
      if (buf.length > MAX_ATTACHMENT_BYTES) {
        errors.push(`user ${u.id}: backup too large for email (${buf.length} bytes)`);
        skipped++;
        continue;
      }

      const b64 = buf.toString("base64");
      const stamp = new Date().toISOString().slice(0, 10);
      const result = await sendResendEmailWithAttachments({
        to: [u.email],
        subject: `ClerkBid cloud backup (${stamp})`,
        html: `
          <p>Your scheduled ClerkBid backup is attached as JSON (<code>clerkbid-cloud-backup-${stamp}.json</code>).</p>
          <p>It contains ${events.length} event snapshot(s) from your cloud saves. Import via Settings → Import full backup if needed.</p>
        `.trim(),
        attachments: [
          {
            filename: `clerkbid-cloud-backup-${stamp}.json`,
            contentBase64: b64,
          },
        ],
      });

      if (result.ok) {
        sent++;
      } else {
        errors.push(`user ${u.id}: ${result.reason}`);
      }
    }

    return NextResponse.json({
      ok: true,
      users: users.length,
      sent,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error("[cron/backup-email]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron failed." },
      { status: 500 }
    );
  }
}
