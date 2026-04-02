"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthPageFrame } from "@/components/layout/AuthPageFrame";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorHint(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        setErrorHint(data.hint ?? null);
        setPending(false);
        return;
      }
      setMessage(data.message ?? "Check your email for next steps.");
      setPending(false);
    } catch {
      setError("Something went wrong.");
      setPending(false);
    }
  }

  return (
    <AuthPageFrame>
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-navy">Forgot password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the email you use for ClerkBid. We will send a link to set a new
          password (expires in one hour).
        </p>
        {message ? (
          <p className="mt-6 text-sm text-ink" role="status">
            {message}
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <div role="alert">
                <p className="text-sm text-danger">{error}</p>
                {errorHint ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {errorHint}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Input
              id="forgot-email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login/" className="font-medium text-navy underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </AuthPageFrame>
  );
}
