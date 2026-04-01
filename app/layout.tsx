import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EventProvider } from "@/components/providers/EventProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "ClerkBid",
  description:
    "Offline-first live auction clerking tool for fundraising organizations",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClerkBid",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <EventProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </EventProvider>
      </body>
    </html>
  );
}
