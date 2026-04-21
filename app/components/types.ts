export interface FeeItem {
  name: string;
  amount: number;
  percentage: number;
}

export interface AnalysisResult {
  grossSales: number;
  totalFees: number;
  netAmount: number;
  feeItems: FeeItem[];
}
