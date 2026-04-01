"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          name: name.trim() || undefined,
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setPending(false);
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account created but sign-in failed. Try logging in.");
        setPending(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Something went wrong.");
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-xl font-bold text-navy">Register your organization</h1>
      <p className="mt-1 text-sm text-muted">
        Creates your vendor workspace. You can invite others later using the
        same registration flow with a new email (each organization registers
        once).
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="reg-org"
          label="Organization name"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
        />
        <Input
          id="reg-name"
          label="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="reg-password"
          label="Password (min 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login/" className="font-medium text-navy underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
