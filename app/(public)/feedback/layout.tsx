import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback | ClerkBid",
  description:
    "Send feedback, bug reports, and feature or workflow change requests for ClerkBid to the AuctionMethod team.",
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
