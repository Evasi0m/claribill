/** A bill image staged for upload — held in component state, not persisted
 *  beyond the analysis call. `preview` is the dataURL for the <img> tag,
 *  `base64` is the same payload sans prefix for the Gemini request. */
export interface UploadedImage {
  id: string;
  preview: string;
  base64: string;
  mimeType: string;
}

export interface FeeItem {
  name: string;
  amount: number;
  percentage: number;
  /** True if the seller added this row manually (AI didn't extract it). Only
   *  user-added rows are deletable from the FeeTable. */
  userAdded?: boolean;
}

export type Platform = "shopee" | "lazada" | "tiktok" | "other";

export interface AnalysisResult {
  /** ยอดรวมสินค้าก่อนหักส่วนลด (ราคาป้าย) */
  labelPrice?: number;
  grossSales: number;
  totalFees: number;
  netAmount: number;
  feeItems: FeeItem[];
  /** แพลตฟอร์มที่ตรวจจับได้จากสลิป */
  platform?: Platform;
}

export interface HistoryEntry {
  id: string;
  /** Unix ms timestamp */
  createdAt: number;
  /** Human note / auto-generated ("บิล Shopee 3 รูป") */
  title: string;
  /** Aggregated analysis result (may be user-edited) */
  result: AnalysisResult;
  /** Cost rate % actually applied when this entry was saved */
  costRate: number;
  /** Profit at save time (netAmount - cost) */
  profit: number;
  /** How many source images */
  imageCount: number;
  /** Tiny JPEG dataURLs (~64x64 each) — visual aid for skimming history.
   *  Optional so older entries without thumbnails still load. */
  thumbnails?: string[];
}
