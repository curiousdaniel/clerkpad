import { NextResponse } from "next/server";
import { sendFeedbackEmail } from "@/lib/email/sendFeedbackEmail";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      message?: string;
      /** Honeypot — must be empty */
      website?: string;
    };

    if (body.website?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const email = body.email?.trim().toLowerCase();
    const message = body.message?.trim();
    const name = body.name?.trim() ?? "";

    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: "Please enter a message (at least 10 characters)." },
        { status: 400 }
      );
    }

    if (message.length > 8000) {
      return NextResponse.json(
        { error: "Message is too long (max 8,000 characters)." },
        { status: 400 }
      );
    }

    if (name.length > 120) {
      return NextResponse.json(
        { error: "Name is too long." },
        { status: 400 }
      );
    }

    const sent = await sendFeedbackEmail({ name, email, message });
    if (!sent.ok) {
      console.error("[feedback]", sent.code, sent.reason);

      const fallback =
        "We could not send your message. You can email info@auctionmethod.com directly.";

      if (sent.code === "domain_not_verified") {
        return NextResponse.json(
          {
            error: fallback,
            hint: "For administrators: the domain in RESEND_FROM must be verified in Resend. Open https://resend.com/domains, add that domain, publish the DNS records Resend provides, wait until it shows “Verified,” then try again. Until then, use RESEND_FROM with a verified domain (e.g. clerkbid.com if verified there) or Resend’s onboarding test sender for non-production.",
          },
          { status: 503 }
        );
      }

      if (sent.code === "missing_config") {
        return NextResponse.json(
          {
            error: fallback,
            hint: "For administrators: set RESEND_API_KEY and RESEND_FROM in Vercel (Environment Variables) and redeploy.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: fallback,
          hint: "For administrators: check Vercel function logs for the Resend API response.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Something went wrong. Try again later." },
      { status: 500 }
    );
  }
}
