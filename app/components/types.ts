export interface FeeItem {
  name: string;
  amount: number;
  percentage: number;
}

export interface AnalysisResult {
  /** ยอดรวมสินค้าก่อนหักส่วนลด (ราคาป้าย) */
  labelPrice?: number;
  grossSales: number;
  totalFees: number;
  netAmount: number;
  feeItems: FeeItem[];
}
