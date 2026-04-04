"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { isOrgAdmin } from "@/lib/auth/orgRole";

type Member = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  orgRole: string;
};

type PendingInvite = {
  id: number;
  email: string;
  orgRole: string;
  expiresAt: string;
  createdAt: string;
};

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "cashier":
      return "Cashier";
    case "clerk":
      return "Clerk";
    default:
      return role;
  }
}

export function OrganizationTeamCard() {
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"clerk" | "cashier">("clerk");
  const [invitePending, setInvitePending] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/org/members/", { credentials: "include" });
      const data = (await res.json()) as {
        error?: string;
        members?: Member[];
        pendingInvites?: PendingInvite[];
      };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load team.");
        setMembers([]);
        setPendingInvites([]);
        return;
      }
      setMembers(data.members ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } catch {
      setLoadError("Could not load team.");
      setMembers([]);
      setPendingInvites([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const admin = isOrgAdmin(session?.user?.orgRole);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast({ kind: "error", message: "Enter an email address." });
      return;
    }
    setInvitePending(true);
    setLastInviteUrl(null);
    try {
      const res = await fetch("/api/org/invite/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgRole: inviteRole }),
      });
      const data = (await res.json()) as {
        error?: string;
        invitePath?: string;
        inviteUrl?: string;
        emailSent?: boolean;
        emailSendError?: string;
      };
      if (!res.ok) {
        showToast({
          kind: "error",
          message: data.error ?? "Could not create invite.",
        });
        return;
      }
      if (typeof window !== "undefined") {
        const full =
          data.inviteUrl?.trim() ||
          (data.invitePath
            ? `${window.location.origin}${data.invitePath}`
            : "");
        if (full) setLastInviteUrl(full);
        if (data.emailSent === true) {
          showToast({
            kind: "success",
            message: `Invitation email sent to ${email}. They can also use the link below if needed.`,
          });
        } else {
          showToast({
            kind: "success",
            message:
              data.emailSendError != null && data.emailSendError.length > 0
                ? `Invite created, but email was not sent (${data.emailSendError}). Copy the link below or configure RESEND_API_KEY and RESEND_FROM (same as password reset).`
                : "Invite created. Copy the link below and send it to your teammate.",
          });
        }
      }
      setInviteEmail("");
      void load();
    } catch {
      showToast({ kind: "error", message: "Could not create invite." });
    } finally {
      setInvitePending(false);
    }
  }

  async function copyInviteUrl() {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      showToast({ kind: "success", message: "Link copied." });
    } catch {
      showToast({ kind: "error", message: "Could not copy to clipboard." });
    }
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-navy dark:text-slate-100">
        Organization &amp; team
      </h2>
      <Card className="space-y-4">
        <p className="text-sm text-muted">
          Everyone in your organization shares the same{" "}
          <strong className="font-medium text-navy dark:text-slate-200">
            cloud backups
          </strong>{" "}
          for each auction event. Sign in with your own email on each device so
          clerk and cashier can work in parallel when online; resolve conflicts
          from Settings if two devices diverge.
        </p>
        {loadError ? (
          <p className="text-sm text-danger" role="alert">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted">Loading team…</p>
        ) : (
          <>
            <div>
              <h3 className="mb-2 text-sm font-medium text-navy dark:text-slate-200">
                Members
              </h3>
              <ul className="divide-y divide-navy/10 rounded-md border border-navy/10 text-sm dark:divide-slate-700 dark:border-slate-700">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span>
                      {m.firstName} {m.lastName}
                      <span className="block text-xs text-muted">{m.email}</span>
                    </span>
                    <span className="rounded bg-navy/5 px-2 py-0.5 text-xs font-medium text-navy dark:bg-slate-800 dark:text-slate-300">
                      {roleLabel(m.orgRole)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {admin ? (
              <>
                {pendingInvites.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-navy dark:text-slate-200">
                      Pending invites
                    </h3>
                    <ul className="text-xs text-muted">
                      {pendingInvites.map((p) => (
                        <li key={p.id}>
                          {p.email} · {roleLabel(p.orgRole)} · expires{" "}
                          {new Date(p.expiresAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <form onSubmit={sendInvite} className="space-y-3 border-t border-navy/10 pt-4 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-navy dark:text-slate-200">
                    Invite a teammate
                  </h3>
                  <p className="text-xs text-muted">
                    We send a sign-up link to this address (requires Resend
                    email setup, same as password reset). You can copy the link
                    below if email is not configured. Only admins can send
                    invites.
                  </p>
                  <Input
                    id="team-invite-email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <div>
                    <label
                      htmlFor="team-invite-role"
                      className="mb-1 block text-sm font-medium text-navy dark:text-slate-200"
                    >
                      Role
                    </label>
                    <select
                      id="team-invite-role"
                      className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-ink dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as "clerk" | "cashier")
                      }
                    >
                      <option value="clerk">Clerk (floor / sales entry)</option>
                      <option value="cashier">Cashier (payments / invoices)</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={invitePending}>
                    {invitePending ? "Sending…" : "Send invitation"}
                  </Button>
                  {lastInviteUrl ? (
                    <div className="rounded-md bg-navy/5 p-3 text-xs dark:bg-slate-800">
                      <p className="mb-2 font-medium text-navy dark:text-slate-200">
                        Invite link (backup if email didn&apos;t arrive)
                      </p>
                      <p className="break-all font-mono text-muted">{lastInviteUrl}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => void copyInviteUrl()}
                      >
                        Copy link
                      </Button>
                    </div>
                  ) : null}
                </form>
              </>
            ) : (
              <p className="text-xs text-muted">
                Your role:{" "}
                <strong>{roleLabel(session?.user?.orgRole ?? "clerk")}</strong>.
                Ask an organization admin to invite more users.
              </p>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
