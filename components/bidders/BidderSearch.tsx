"use client";

import { Search } from "lucide-react";

export function BidderSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="bidder-search"
        className="mb-1 block text-sm font-medium text-ink"
      >
        Search bidders
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          id="bidder-search"
          type="search"
          placeholder="Name, paddle, phone, email…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="w-full rounded-lg border border-navy/20 bg-white py-2 pl-9 pr-3 font-mono text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>
    </div>
  );
}
