import { ProtectedShell } from "./ProtectedShell";

/** Default caching so the PWA service worker can store app shells for offline navigations. */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
