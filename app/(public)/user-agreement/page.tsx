import fs from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal/LegalDocShell";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";

export const metadata: Metadata = {
  title: "User agreement | ClerkBid",
  description:
    "Terms of use for ClerkBid, a free auction clerking tool from AuctionMethod.",
};

export default async function UserAgreementPage() {
  const filePath = path.join(
    process.cwd(),
    "terms",
    "clerkbid_user_agreement.md"
  );
  const content = await fs.readFile(filePath, "utf-8");

  return (
    <LegalDocShell>
      <LegalMarkdown content={content} />
    </LegalDocShell>
  );
}
