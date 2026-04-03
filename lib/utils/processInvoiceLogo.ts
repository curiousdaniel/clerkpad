const MAX_FILE_BYTES = 600 * 1024;
const MAX_WIDTH_PX = 480;

/**
 * Normalize logo to PNG for reliable jsPDF embedding; downscale wide images.
 */
export async function processInvoiceLogoFile(
  file: File
): Promise<{ blob: Blob; mime: string } | { error: string }> {
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
    return { error: "Please choose a PNG, JPEG, or WebP image." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "Image must be 600 KB or smaller." };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH_PX / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { error: "Could not process image." };
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) return { error: "Could not process image." };
    return { blob, mime: "image/png" };
  } catch {
    return { error: "Could not read image." };
  }
}
