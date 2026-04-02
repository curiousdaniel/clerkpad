import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppProviders } from "./providers";

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
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
