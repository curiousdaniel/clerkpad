import type { AuctionDB } from "@/lib/db";
import { ensureSettingsRow } from "@/lib/settings";

export function resolveInvoiceFooterText(
  raw: string | undefined | null,
  organizationName: string
): string {
  const t = raw?.trim();
  if (!t) {
    return `Thank you for supporting ${organizationName}!`;
  }
  return t.includes("{org}") ? t.split("{org}").join(organizationName) : t;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

function loadImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = dataUrl;
  });
}

const LOGO_MAX_W_MM = 50;
const LOGO_MAX_H_MM = 22;

export function logoSizeMm(
  naturalW: number,
  naturalH: number
): { wMm: number; hMm: number } {
  const ar = naturalH / naturalW;
  let wMm = LOGO_MAX_W_MM;
  let hMm = wMm * ar;
  if (hMm > LOGO_MAX_H_MM) {
    hMm = LOGO_MAX_H_MM;
    wMm = hMm / ar;
  }
  return { wMm, hMm };
}

export type ResolvedInvoiceBranding = {
  footerLine: string;
  logoDataUrl?: string;
  logoWidthMm?: number;
  logoHeightMm?: number;
};

/**
 * Event-local overrides user defaults. Logos are device-local (not in JSON export).
 */
export async function resolveInvoiceBrandingForPdf(
  db: AuctionDB,
  eventId: number,
  organizationName: string
): Promise<ResolvedInvoiceBranding> {
  await ensureSettingsRow(db);
  const settings = await db.settings.get(1);
  const local = await db.eventLocalBranding.where("eventId").equals(eventId).first();

  const footerRaw =
    local?.invoiceFooterMessage?.trim() ||
    settings?.invoiceFooterMessage?.trim() ||
    null;
  const footerLine = resolveInvoiceFooterText(footerRaw, organizationName);

  const blob = local?.invoiceLogoBlob ?? settings?.invoiceLogoBlob;
  if (!blob || blob.size === 0) {
    return { footerLine };
  }

  try {
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await loadImageDimensions(dataUrl);
    const { wMm, hMm } = logoSizeMm(width, height);
    return {
      footerLine,
      logoDataUrl: dataUrl,
      logoWidthMm: wMm,
      logoHeightMm: hMm,
    };
  } catch {
    return { footerLine };
  }
}
