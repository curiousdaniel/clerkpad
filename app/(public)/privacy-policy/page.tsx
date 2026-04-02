import fs from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal/LegalDocShell";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";

export const metadata: Metadata = {
  title: "Privacy policy | ClerkBid",
  description:
    "How AuctionMethod collects, uses, and shares information through ClerkBid.",
};

export default async function PrivacyPolicyPage() {
  const filePath = path.join(
    process.cwd(),
    "terms",
    "clerkbid_privacy_policy.md"
  );
  const content = await fs.readFile(filePath, "utf-8");

  return (
    <LegalDocShell>
      <LegalMarkdown content={content} />
    </LegalDocShell>
  );
}
