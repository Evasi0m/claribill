import type { AnalysisResult, HistoryEntry } from "../components/types";
import { rateFor, type PlatformRates } from "./platform";
import { updateHistory } from "./storage";

/** Cost basis used everywhere — when the bill doesn't surface a separate
 *  pre-discount price (Shopee/Lazada), we fall back to grossSales so the
 *  calculation degrades gracefully but the seller still sees the
 *  LabelPriceNotice prompting them to enter the real tag price. */
export function basisOf(result: Pick<AnalysisResult, "labelPrice" | "grossSales">): number {
  return result.labelPrice ?? result.grossSales;
}

/** costRate is the seller's "discount-from-tag-price" percentage, so the
 *  cost they actually paid is `basis × (1 − costRate%)`. costRate is
 *  validated as a finite number in (0, 100); guard against bogus values
 *  here so callers don't have to. */
export function computeCost(basis: number, costRate: number): number {
  if (!Number.isFinite(costRate) || costRate <= 0 || costRate >= 100) return 0;
  return basis * (1 - costRate / 100);
}

export interface ProfitBreakdown {
  /** Reference price for the cost calculation (labelPrice or grossSales). */
  basis: number;
  /** Cost the seller paid for the goods. */
  cost: number;
  /** netAmount − cost. Negative when fees + cost exceed what came in. */
  profit: number;
  /** profit / basis × 100. NaN-safe (returns 0 when basis is 0). */
  marginPct: number;
}

/** One-shot computation used by Dashboard's render path and every state
 *  mutation that needs to update the persisted history entry's profit. */
export function computeProfit(
  result: AnalysisResult,
  costRate: number,
): ProfitBreakdown {
  const basis = basisOf(result);
  const cost = computeCost(basis, costRate);
  const profit = result.netAmount - cost;
  const marginPct = basis > 0 ? (profit / basis) * 100 : 0;
  return { basis, cost, profit, marginPct };
}

/** Persist a result update to the matching history entry and return the new
 *  history list. No-op when there's no active entry, so freshly-analyzed
 *  bills (which are always saved before edits) and history-detached results
 *  both work without branching at the call site. */
export function syncResultToHistory(
  merged: AnalysisResult,
  currentEntryId: string | null,
  platformRates: PlatformRates,
): HistoryEntry[] | null {
  if (!currentEntryId) return null;
  const costRate = rateFor(platformRates, merged.platform);
  const { profit } = computeProfit(merged, costRate);
  return updateHistory(currentEntryId, {
    result: merged,
    costRate,
    profit,
  });
}
