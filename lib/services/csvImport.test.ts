import { describe, expect, it } from "vitest";
import { parseBidderCsv } from "./csvImportBidders";
import { parseConsignorCsv } from "./csvImportConsignors";
import { parseLotCsv } from "./csvImportLots";

describe("parseBidderCsv", () => {
  it("parses standard headers", () => {
    const csv = `paddleNumber,firstName,lastName,email,phone
101,Jane,Doe,j@x.com,555`;
    const { rows, issues } = parseBidderCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows).toEqual([
      {
        paddleNumber: 101,
        firstName: "Jane",
        lastName: "Doe",
        email: "j@x.com",
        phone: "555",
      },
    ]);
  });

  it("detects duplicate paddles in file", () => {
    const csv = `paddle,first,last
1,A,B
1,C,D`;
    const { rows, issues } = parseBidderCsv(csv);
    expect(rows).toHaveLength(1);
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });
});

describe("parseLotCsv", () => {
  it("builds display lot from base and suffix", () => {
    const csv = `baseLotNumber,suffix,description,quantity
12,A,Widget,1`;
    const { rows, issues } = parseLotCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0]?.displayLotNumber).toBe("12A");
  });

  it("parses optional consignorNumber", () => {
    const csv = `base,suffix,description,consignorNumber,quantity
5,,Chair,42,1`;
    const { rows, issues } = parseLotCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0]?.consignorNumber).toBe(42);
  });
});

describe("parseConsignorCsv", () => {
  it("parses commission percent", () => {
    const csv = `consignorNumber,name,commission
7,Jane Doe,12.5`;
    const { rows, issues } = parseConsignorCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0]?.commissionPct).toBe(12.5);
  });

  it("parses mailing address column", () => {
    const csv = `consignorNumber,name,mailingAddress
8,Bob,PO Box 1`;
    const { rows, issues } = parseConsignorCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0]?.mailingAddress).toBe("PO Box 1");
  });
});
