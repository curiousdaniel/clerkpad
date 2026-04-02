import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AuctionEvent, Bidder, Lot } from "@/lib/db";
import {
  AUCTION_METHOD_BRAND,
  AUCTION_METHOD_URL,
} from "@/lib/utils/attribution";
import { compareLotsForReport } from "@/lib/services/reportCalculator";

function drawPdfAttributionFooter(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 8;
  const prefix = "Powered by ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  const wPrefix = doc.getTextWidth(prefix);
  const wBrand = doc.getTextWidth(AUCTION_METHOD_BRAND);
  const startX = (pageW - (wPrefix + wBrand)) / 2;
  doc.text(prefix, startX, footerY);
  const docWithLink = doc as jsPDF & {
    textWithLink: (
      text: string,
      x: number,
      y: number,
      opts: { url: string }
    ) => number;
  };
  docWithLink.textWithLink(AUCTION_METHOD_BRAND, startX + wPrefix, footerY, {
    url: AUCTION_METHOD_URL,
  });
  doc.setTextColor(0, 0, 0);
}

export function buildRunListPdf(
  event: AuctionEvent,
  lots: Lot[]
): jsPDF {
  const doc = new jsPDF();
  const sorted = [...lots].sort(compareLotsForReport);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text("Run list", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(event.organizationName, 14, 26);
  doc.text(event.name, 14, 32);

  const body = sorted.map((l) => [
    l.displayLotNumber,
    l.status,
    l.description,
    l.consignor ?? "",
    l.notes ?? "",
    String(l.quantity),
  ]);

  autoTable(doc, {
    startY: 38,
    head: [["Lot", "Status", "Description", "Consignor", "Notes", "Qty"]],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 55 },
      3: { cellWidth: 28 },
      4: { cellWidth: 35 },
      5: { cellWidth: 12 },
    },
  });

  doc.setPage(doc.getNumberOfPages());
  drawPdfAttributionFooter(doc);
  return doc;
}

export function buildBidderListPdf(
  event: AuctionEvent,
  bidders: Bidder[]
): jsPDF {
  const doc = new jsPDF();
  const sorted = [...bidders].sort((a, b) => a.paddleNumber - b.paddleNumber);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text("Bidder list", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(event.organizationName, 14, 26);
  doc.text(event.name, 14, 32);

  const body = sorted.map((b) => [
    String(b.paddleNumber),
    `${b.firstName} ${b.lastName}`,
    b.phone ?? "",
    b.email ?? "",
  ]);

  autoTable(doc, {
    startY: 38,
    head: [["Paddle", "Name", "Phone", "Email"]],
    body,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 55 },
    },
  });

  doc.setPage(doc.getNumberOfPages());
  drawPdfAttributionFooter(doc);
  return doc;
}

export function saveListPdf(doc: jsPDF, filename: string): void {
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
