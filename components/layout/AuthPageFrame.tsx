import type { ReactNode } from "react";

/** Centers sign-in / sign-up flows; the marketing home page is full-width. */
export function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
