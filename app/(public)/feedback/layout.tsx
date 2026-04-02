import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback | ClerkBid",
  description:
    "Send questions or feedback about ClerkBid to the AuctionMethod team.",
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
