"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPageFrame } from "@/components/layout/AuthPageFrame";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Reset failed.");
        setPending(false);
        return;
      }
      setDone(true);
      setPending(false);
      setTimeout(() => {
        router.replace("/login/");
      }, 2000);
    } catch {
      setError("Something went wrong.");
      setPending(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Invalid link</h1>
        <p className="mt-2 text-sm text-muted">
          This page needs a valid reset link from your email.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password/" className="font-medium text-navy underline">
            Request a new link
          </Link>
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Password updated</h1>
        <p className="mt-2 text-sm text-muted">
          You can sign in with your new password. Redirecting to sign in…
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-xl font-bold text-navy">Set a new password</h1>
      <p className="mt-1 text-sm text-muted">
        Choose a strong password (at least 8 characters).
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          id="reset-confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login/" className="font-medium text-navy underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPageFrame>
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <p className="text-sm text-muted">Loading…</p>
          </Card>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthPageFrame>
  );
}
