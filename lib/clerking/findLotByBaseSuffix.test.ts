import "fake-indexeddb/auto";
import { describe, expect, it, afterEach } from "vitest";
import Dexie from "dexie";
import { AuctionDB } from "@/lib/db";
import { findLotByEventBaseAndSuffix } from "@/lib/clerking/findLotByBaseSuffix";

let db: AuctionDB;

afterEach(async () => {
  db.close();
  await Dexie.delete(db.name);
});

describe("findLotByEventBaseAndSuffix", () => {
  it("matches by lotSuffix when set", async () => {
    const uid = `lotfind_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    db = new AuctionDB(uid);
    const eventId = (await db.events.add({
      name: "E",
      organizationName: "O",
      taxRate: 0,
      buyersPremiumRate: 0,
      defaultConsignorCommissionRate: 0,
      currencySymbol: "$",
      syncId: "aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;
    await db.lots.add({
      eventId,
      baseLotNumber: 4,
      lotSuffix: "S",
      displayLotNumber: "4S",
      description: "Gift cert",
      quantity: 1,
      status: "unsold",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const lot = await findLotByEventBaseAndSuffix(db, eventId, 4, "S");
    expect(lot?.description).toBe("Gift cert");
  });

  it("falls back to displayLotNumber for legacy rows with empty lotSuffix", async () => {
    const uid = `lotfind2_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    db = new AuctionDB(uid);
    const eventId = (await db.events.add({
      name: "E",
      organizationName: "O",
      taxRate: 0,
      buyersPremiumRate: 0,
      defaultConsignorCommissionRate: 0,
      currencySymbol: "$",
      syncId: "bbbbbbbb-bbbb-1ccc-9ddd-eeeeeeeeeeee",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;
    await db.lots.add({
      eventId,
      baseLotNumber: 4,
      lotSuffix: "",
      displayLotNumber: "4S",
      description: "Legacy import",
      quantity: 1,
      status: "unsold",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const lotS = await findLotByEventBaseAndSuffix(db, eventId, 4, "S");
    expect(lotS?.description).toBe("Legacy import");
  });
});
