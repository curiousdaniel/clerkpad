"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthPageFrame } from "@/components/layout/AuthPageFrame";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setPending(false);
        return;
      }
      window.location.href = "/dashboard/";
    } catch {
      setError("Sign in failed. Try again.");
      setPending(false);
    }
  }

  return (
    <AuthPageFrame>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Sign in to ClerkBid</h1>
        <p className="mt-1 text-sm text-muted">
          Use the account for your organization. After signing in, you can
          install the app and work offline until your session expires.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Input
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-1">
            <div className="flex items-end justify-between gap-2">
              <label
                htmlFor="login-password"
                className="text-sm font-medium text-ink"
              >
                Password
              </label>
              <Link
                href="/forgot-password/"
                className="text-xs font-medium text-navy underline dark:text-slate-200"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              label=""
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          No account?{" "}
          <Link
            href="/register/"
            className="font-medium text-navy underline dark:text-slate-200"
          >
            Register your organization
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          Invited by a teammate? Open the join link your admin copied from
          Settings (don&apos;t use &quot;Register your organization&quot;).
        </p>
        <p className="mt-4 text-center text-xs text-muted">
          <Link
            href="/user-agreement/"
            className="underline underline-offset-2 hover:text-ink dark:text-slate-300 dark:hover:text-slate-100"
          >
            User agreement
          </Link>
          <span className="mx-2 text-navy/20 dark:text-slate-600">·</span>
          <Link
            href="/privacy-policy/"
            className="underline underline-offset-2 hover:text-ink dark:text-slate-300 dark:hover:text-slate-100"
          >
            Privacy policy
          </Link>
          <span className="mx-2 text-navy/20 dark:text-slate-600">·</span>
          <Link
            href="/feedback/"
            className="underline underline-offset-2 hover:text-ink dark:text-slate-300 dark:hover:text-slate-100"
          >
            Feedback
          </Link>
        </p>
      </Card>
    </AuthPageFrame>
  );
}
