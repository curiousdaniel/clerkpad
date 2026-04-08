"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AdminUserRow } from "@/lib/admin/userStats";
import { formatDateTime } from "@/lib/utils/formatDate";
import { isSuperAdminUserIdAndEmail } from "@/lib/auth/superAdmin";

export function AdminDashboard({
  initialUsers,
  loadError,
}: {
  initialUsers: AdminUserRow[];
  loadError: string | null;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceSeverity, setAnnounceSeverity] = useState<
    "info" | "warning"
  >("info");
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceError, setAnnounceError] = useState<string | null>(null);
  const [announceOk, setAnnounceOk] = useState<string | null>(null);

  const showAdmin =
    status === "authenticated" &&
    session?.user &&
    isSuperAdminUserIdAndEmail(session.user.id, session.user.email) &&
    !session.impersonatedByUserId;

  async function signInAs(targetUserId: number) {
    setPendingId(targetUserId);
    try {
      const res = await fetch("/api/admin/impersonate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = (await res.json()) as {
        impersonationToken?: string;
        error?: string;
      };
      if (!res.ok || !data.impersonationToken) {
        window.alert(data.error ?? "Could not start impersonation.");
        return;
      }
      await signIn("admin-impersonate", {
        impersonationToken: data.impersonationToken,
        redirect: true,
        callbackUrl: "/dashboard/",
      });
    } catch {
      window.alert("Something went wrong.");
    } finally {
      setPendingId(null);
    }
  }

  /** Defer after click so the browser can paint before confirm/fetch (INP). */
  function requestDeleteUser(target: AdminUserRow) {
    window.setTimeout(() => {
      void runDeleteUser(target);
    }, 0);
  }

  async function runDeleteUser(target: AdminUserRow) {
    const ok = window.confirm(
      `Permanently delete user ${target.email} (ID ${target.id})?\n\n` +
        `This cannot be undone. If they are the last member of “${target.vendor_name}”, the organization and its cloud backups will be removed.`
    );
    if (!ok) return;

    setDeletingId(target.id);
    try {
      const res = await fetch("/api/admin/delete-user/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.setTimeout(() => {
          window.alert(data.error ?? "Could not delete user.");
        }, 0);
        return;
      }
      // Await refresh so RSC picks up the new user list (startTransition deferred
      // updates and left stale initialUsers until a full reload).
      await router.refresh();
    } catch {
      window.setTimeout(() => {
        window.alert("Something went wrong.");
      }, 0);
    } finally {
      setDeletingId(null);
    }
  }

  async function sendAnnouncement(e: FormEvent) {
    e.preventDefault();
    setAnnounceError(null);
    setAnnounceOk(null);
    const body = announceBody.trim();
    if (!body) {
      setAnnounceError("Message is required.");
      return;
    }
    setAnnounceSending(true);
    try {
      const res = await fetch("/api/admin/ably-announce/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announceTitle.trim() || undefined,
          body,
          severity: announceSeverity,
        }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setAnnounceError(data.error ?? "Request failed.");
        return;
      }
      setAnnounceOk(`Sent (id ${data.id ?? "?"})`);
      setAnnounceBody("");
      setAnnounceTitle("");
    } catch {
      setAnnounceError("Something went wrong.");
    } finally {
      setAnnounceSending(false);
    }
  }

  if (status === "loading") {
    return (
      <div>
        <Header title="Admin" description="Loading…" />
        <p className="mt-4 text-sm text-muted">Loading session…</p>
      </div>
    );
  }

  if (!showAdmin) {
    return (
      <div>
        <Header title="Admin" description="Restricted." />
        <p className="mt-4 text-sm text-muted">You do not have access.</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Admin"
        description="User accounts and cloud-sync statistics. Counts reflect server backups only, not unsynced local data."
      />

      {loadError ? (
        <Card className="mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          {loadError}
        </Card>
      ) : null}

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-semibold text-ink dark:text-slate-100">
          Global in-app announcement
        </h2>
        <p className="mt-1 text-xs text-muted">
          Delivers a toast to signed-in ClerkBid users via Ably channel{" "}
          <code className="rounded bg-surface-muted px-1 font-mono text-[11px]">
            clerkbid:announce
          </code>
          . Clients need{" "}
          <code className="rounded bg-surface-muted px-1 font-mono text-[11px]">
            NEXT_PUBLIC_ABLY_SYNC=1
          </code>{" "}
          and the server needs{" "}
          <code className="rounded bg-surface-muted px-1 font-mono text-[11px]">
            ABLY_API_KEY
          </code>
          .
        </p>
        <form className="mt-4 space-y-3" onSubmit={(ev) => void sendAnnouncement(ev)}>
          <Input
            id="announce-title"
            label="Title (optional)"
            value={announceTitle}
            onChange={(ev) => setAnnounceTitle(ev.target.value)}
            maxLength={120}
            placeholder="e.g. Scheduled maintenance"
            disabled={announceSending}
          />
          <div className="w-full">
            <label
              htmlFor="announce-body"
              className="mb-1 block text-sm font-medium text-ink dark:text-slate-200"
            >
              Message
            </label>
            <textarea
              id="announce-body"
              value={announceBody}
              onChange={(ev) => setAnnounceBody(ev.target.value)}
              maxLength={2000}
              rows={4}
              disabled={announceSending}
              placeholder="Shown as an in-app toast for all signed-in users."
              className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink dark:text-slate-200">
              <span className="text-muted">Severity</span>
              <select
                value={announceSeverity}
                onChange={(ev) =>
                  setAnnounceSeverity(
                    ev.target.value === "warning" ? "warning" : "info"
                  )
                }
                disabled={announceSending}
                className="rounded-lg border border-navy/20 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
              </select>
            </label>
            <Button type="submit" disabled={announceSending}>
              {announceSending ? "Sending…" : "Send announcement"}
            </Button>
          </div>
          {announceError ? (
            <p className="text-sm text-danger" role="alert">
              {announceError}
            </p>
          ) : null}
          {announceOk ? (
            <p className="text-sm text-success dark:text-emerald-400">
              {announceOk}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-navy/10 bg-surface-muted/50 text-xs font-semibold uppercase tracking-wide text-muted dark:border-slate-700 dark:bg-slate-800/40">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3 text-right">Lots</th>
              <th className="px-4 py-3 text-right">Bidders</th>
              <th className="px-4 py-3 text-right">Sales</th>
              <th className="px-4 py-3">Last sync</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10 dark:divide-slate-700">
            {initialUsers.map((u) => {
              const isSelf =
                Number(session.user.id) === u.id ||
                session.user.email?.toLowerCase() === u.email.toLowerCase();
              return (
                <tr key={u.id} className="bg-white/40 dark:bg-slate-900/20">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-ink dark:text-slate-100">
                      {u.first_name} {u.last_name}
                    </div>
                    <div className="text-xs text-muted">{u.email}</div>
                    <div className="text-xs text-muted">ID {u.id}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="text-ink dark:text-slate-200">{u.vendor_name}</div>
                    <div className="text-xs">{u.vendor_slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.synced_events}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.total_lots}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.total_bidders}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.total_sales}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted">
                    {u.last_cloud_sync
                      ? formatDateTime(u.last_cloud_sync)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isSelf ? (
                      <span className="text-xs text-muted">You</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pendingId != null || deletingId != null}
                          onClick={() => void signInAs(u.id)}
                        >
                          {pendingId === u.id ? "Signing in…" : "Sign in as"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            pendingId != null ||
                            deletingId != null ||
                            isSuperAdminUserIdAndEmail(String(u.id), u.email)
                          }
                          className="border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
                          onClick={() => requestDeleteUser(u)}
                          title={
                            isSuperAdminUserIdAndEmail(String(u.id), u.email)
                              ? "Super-admin accounts cannot be deleted here."
                              : undefined
                          }
                        >
                          {deletingId === u.id ? "Deleting…" : "Delete user"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {initialUsers.length === 0 && !loadError ? (
          <p className="p-6 text-sm text-muted">No users yet.</p>
        ) : null}
      </Card>

      <p className="mt-6 text-xs text-muted">
        Impersonation and user deletion are audited in your server logs. Use
        only to support customers who expect you to access or manage their
        account.
      </p>
    </div>
  );
}
