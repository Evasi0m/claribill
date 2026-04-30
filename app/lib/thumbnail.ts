/** Render a base64 image data URL as a small JPEG thumbnail. Used to keep
 *  HistoryEntry lightweight enough that 200 entries × N images stay well
 *  under the ~5MB localStorage budget — the source images themselves are
 *  not persisted. */

const MAX_DIM = 64;
const QUALITY = 0.6;

export async function makeThumbnail(dataUrl: string): Promise<string> {
  // Match canvas APIs to the runtime — bail on SSR / Node.
  if (typeof document === "undefined") return dataUrl;

  const img = await loadImage(dataUrl);
  const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  // image/jpeg shrinks aggressively for photos (slip screenshots); png would
  // double the storage cost for marginal quality gain at this size.
  return canvas.toDataURL("image/jpeg", QUALITY);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ไม่สามารถโหลดรูปสำหรับ thumbnail"));
    img.src = src;
  });
}
