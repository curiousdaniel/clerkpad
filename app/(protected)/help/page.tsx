import path from "path";
import fs from "fs/promises";
import type { Metadata } from "next";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const metadata: Metadata = {
  title: "Help and FAQ | ClerkBid",
  description:
    "How to use ClerkBid: events, bidders, consignors, clerking, invoices, reports, and settings.",
};

export default async function HelpPage() {
  const filePath = path.join(process.cwd(), "docs", "clerkbid_help.md");
  const markdown = await fs.readFile(filePath, "utf-8");

  return <HelpPageShell markdown={markdown} />;
}
