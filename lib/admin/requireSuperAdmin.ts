import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  isImpersonatingSession,
  isSuperAdminSession,
} from "@/lib/auth/superAdmin";

export async function requireSuperAdminNotImpersonating(): Promise<
  Session | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isSuperAdminSession(session) || isImpersonatingSession(session)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return session;
}

/** Caller is in an impersonation session (may request revert). */
export async function requireImpersonationSession(): Promise<
  Session | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isImpersonatingSession(session) || !session.impersonatedByUserId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return session;
}
