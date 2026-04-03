import { describe, expect, it } from "vitest";
import {
  extractEmailDomain,
  isConsumerEmailDomain,
} from "@/lib/hubspot/emailDomain";

describe("extractEmailDomain", () => {
  it("returns lowercase domain", () => {
    expect(extractEmailDomain("Jane@Example.COM")).toBe("example.com");
  });

  it("handles plus addressing", () => {
    expect(extractEmailDomain("user+tag@gmail.com")).toBe("gmail.com");
  });

  it("returns null for invalid input", () => {
    expect(extractEmailDomain("")).toBeNull();
    expect(extractEmailDomain("nope")).toBeNull();
    expect(extractEmailDomain("@only.com")).toBeNull();
    expect(extractEmailDomain("a@b")).toBeNull();
  });
});

describe("isConsumerEmailDomain", () => {
  it("detects common consumer domains", () => {
    expect(isConsumerEmailDomain("gmail.com")).toBe(true);
    expect(isConsumerEmailDomain("GMAIL.COM")).toBe(true);
    expect(isConsumerEmailDomain("outlook.com")).toBe(true);
    expect(isConsumerEmailDomain("icloud.com")).toBe(true);
  });

  it("returns false for likely business domains", () => {
    expect(isConsumerEmailDomain("acme-auctions.com")).toBe(false);
    expect(isConsumerEmailDomain("auctionmethod.com")).toBe(false);
  });
});
