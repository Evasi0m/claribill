export interface FeeItem {
  name: string;
  amount: number;
  percentage: number;
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
}
