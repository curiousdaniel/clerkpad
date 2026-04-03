import { describe, expect, it } from "vitest";
import { resolveInvoiceFooterText } from "./invoiceBranding";

describe("resolveInvoiceFooterText", () => {
  it("uses default when empty", () => {
    expect(resolveInvoiceFooterText("", "Acme")).toBe(
      "Thank you for supporting Acme!"
    );
    expect(resolveInvoiceFooterText(undefined, "Acme")).toBe(
      "Thank you for supporting Acme!"
    );
  });

  it("substitutes {org}", () => {
    expect(resolveInvoiceFooterText("Bid high at {org}.", "Acme")).toBe(
      "Bid high at Acme."
    );
  });

  it("uses custom text as-is when no placeholder", () => {
    expect(resolveInvoiceFooterText("We appreciate your business.", "Acme")).toBe(
      "We appreciate your business."
    );
  });
});
