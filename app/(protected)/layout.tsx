import { ProtectedShell } from "./ProtectedShell";

/** Avoid long-lived CDN/static HTML for authenticated routes. */
export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
