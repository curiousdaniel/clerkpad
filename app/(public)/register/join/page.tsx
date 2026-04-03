"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthPageFrame } from "@/components/layout/AuthPageFrame";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function RegisterJoinFallback() {
  return (
    <AuthPageFrame>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Join your organization</h1>
        <p className="mt-2 text-sm text-muted">Loading…</p>
      </Card>
    </AuthPageFrame>
  );
}

function RegisterJoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidateError("Missing invite link. Ask your admin for a new invite.");
      setValidating(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/invite/validate/?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as {
          error?: string;
          organizationName?: string;
          email?: string;
          orgRole?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setValidateError(data.error ?? "Invalid invite.");
          return;
        }
        setOrganizationName(data.organizationName ?? null);
        setInviteEmail(data.email ?? null);
        setInviteRole(data.orgRole ?? null);
        setEmail(data.email ?? "");
      } catch {
        if (!cancelled) setValidateError("Could not validate invite.");
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/register/join/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setPending(false);
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account created but sign-in failed. Try logging in.");
        setPending(false);
        return;
      }
      window.location.href = "/dashboard/";
    } catch {
      setError("Something went wrong.");
      setPending(false);
    }
  }

  return (
    <AuthPageFrame>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Join your organization</h1>
        {validating ? (
          <p className="mt-2 text-sm text-muted">Checking invite…</p>
        ) : validateError ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {validateError}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              You&apos;re joining{" "}
              <strong className="text-navy dark:text-slate-200">
                {organizationName}
              </strong>
              {inviteRole ? (
                <>
                  {" "}
                  as{" "}
                  <strong className="text-navy dark:text-slate-200">
                    {inviteRole === "cashier" ? "Cashier" : "Clerk"}
                  </strong>
                </>
              ) : null}
              . Use the invited email below.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  id="join-first-name"
                  label="First name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  id="join-last-name"
                  label="Last name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <Input
                id="join-email"
                label="Email (must match invite)"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!inviteEmail}
                className={inviteEmail ? "opacity-90" : undefined}
              />
              <Input
                id="join-password"
                label="Password (min 8 characters)"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account…" : "Create account & sign in"}
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link
            href="/login/"
            className="font-medium text-navy underline dark:text-slate-200"
          >
            Sign in
          </Link>{" "}
          ·{" "}
          <Link
            href="/register/"
            className="font-medium text-navy underline dark:text-slate-200"
          >
            Register a new organization
          </Link>
        </p>
      </Card>
    </AuthPageFrame>
  );
}

export default function RegisterJoinPage() {
  return (
    <Suspense fallback={<RegisterJoinFallback />}>
      <RegisterJoinContent />
    </Suspense>
  );
}
