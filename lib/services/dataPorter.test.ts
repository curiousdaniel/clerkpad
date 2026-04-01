import { describe, expect, it } from "vitest";
import { parseFullDatabaseExport } from "./dataPorter";

describe("parseFullDatabaseExport", () => {
  it("rejects invalid wrapper", () => {
    expect(() => parseFullDatabaseExport(null)).toThrow();
    expect(() => parseFullDatabaseExport({})).toThrow();
  });

  it("parses minimal valid structure", () => {
    const raw = {
      fullExportVersion: 1,
      exportDate: "2026-01-01T00:00:00Z",
      appVersion: "0.1.0",
      events: [
        {
          exportVersion: 1,
          exportDate: "2026-01-01T00:00:00Z",
          appVersion: "0.1.0",
          event: {
            name: "Test",
            organizationName: "Org",
            taxRate: 0,
            currencySymbol: "$",
            createdAt: "2026-01-01T00:00:00Z",
          },
          bidders: [],
          lots: [],
          sales: [],
          invoices: [],
        },
      ],
    };
    const p = parseFullDatabaseExport(raw);
    expect(p.events).toHaveLength(1);
    expect(p.events[0].event.name).toBe("Test");
  });
});
