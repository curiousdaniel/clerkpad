"use client";

import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";

export function ImpersonationBanner() {
  const { data: session } = useSession();

  if (!session?.impersonatedByUserId) return null;

  async function revert() {
    try {
      const res = await fetch("/api/admin/revert/", { method: "POST" });
      const data = (await res.json()) as {
        impersonationToken?: string;
        error?: string;
      };
      if (!res.ok || !data.impersonationToken) {
        window.alert(data.error ?? "Could not return to admin session.");
        return;
      }
      await signIn("admin-impersonate", {
        impersonationToken: data.impersonationToken,
        redirect: true,
        callbackUrl: "/admin/",
      });
    } catch {
      window.alert("Something went wrong.");
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-ink dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-slate-100 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p>
        <span className="font-semibold text-navy dark:text-amber-100">
          Impersonation mode
        </span>
        — you are signed in as{" "}
        <span className="font-medium">
          {session.user.name ?? session.user.email}
        </span>
        . Cloud and local data may not match their device until you pull backups.
      </p>
      <Button type="button" variant="secondary" onClick={() => void revert()}>
        Return to admin
      </Button>
    </div>
  );
}
