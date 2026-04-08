import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Ably from "ably";
import { authOptions } from "@/lib/auth/options";
import { ablyClientSubscribeCapability } from "@/lib/ably/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const key = process.env.ABLY_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Ably is not configured." },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const vendorId = parseInt(session.user.vendorId, 10);
    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const rest = new Ably.Rest({ key });
    const tokenRequest = await rest.auth.createTokenRequest({
      // Omit clientId so multiple tabs for the same user can subscribe without
      // Ably disconnecting earlier connections (same clientId is single-connection).
      capability: ablyClientSubscribeCapability(vendorId) as Record<
        string,
        ["subscribe"]
      >,
    });

    return NextResponse.json(tokenRequest);
  } catch (e) {
    console.error("[ably/auth]", e);
    return NextResponse.json({ error: "Token request failed." }, { status: 500 });
  }
}
