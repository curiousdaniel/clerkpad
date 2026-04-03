export type HelpFaqItem = { question: string; answer: string };

export const helpFaqs: HelpFaqItem[] = [
  {
    question: "Where is my data stored?",
    answer:
      "Auction data for each signed-in user lives in an IndexedDB database on this device (your browser). It is not sent to ClerkBid servers except when you use optional cloud backup/sync or email features you turn on.",
  },
  {
    question: "Why do I need to select an event?",
    answer:
      "Bidders, lots, sales, invoices, consignors, and reports are all scoped to one event at a time. Use the event switcher in the sidebar to change context.",
  },
  {
    question: "What is the difference between hammer and invoice total?",
    answer:
      "Hammer is the winning bid amount for a lot. Invoice totals add buyer’s premium (if configured) and tax on top of hammer lines, depending on your event settings.",
  },
  {
    question: "Can I undo a sale?",
    answer:
      "After you record a sale, a short undo window appears on the clerking screen. Use it immediately if you need to reverse the last action.",
  },
  {
    question: "Do logos on invoices sync to the cloud?",
    answer:
      "Invoice logos and per-event invoice footer overrides are stored locally for privacy and size. JSON event export and cloud snapshot payloads do not include those image blobs.",
  },
  {
    question: "How do consignor commissions work?",
    answer:
      "Set a default commission percent on the event in Settings. Individual consignors can have an override percent. Statements and commission reports use the effective rate per line.",
  },
];
