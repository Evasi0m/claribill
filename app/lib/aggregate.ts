import type { AnalysisResult, FeeItem, Platform } from "../components/types";

/** Merge multiple analyzed bills into one. The seller can upload N images
 *  for a single sale (front + back of a slip, multiple orders in a session)
 *  and we want the result view to look like one consolidated bill. */
export function aggregate(results: AnalysisResult[]): AnalysisResult {
  const sum = (
    key: keyof Pick<AnalysisResult, "labelPrice" | "grossSales" | "totalFees" | "netAmount">,
  ) => results.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const labelPrice = sum("labelPrice") || sum("grossSales");
  const grossSales = sum("grossSales");
  const totalFees = sum("totalFees");
  const netAmount = sum("netAmount");

  // Detect dominant platform (most common non-`other` wins; fallback `other`)
  const counts = new Map<Platform, number>();
  for (const r of results) {
    const p = (r.platform ?? "other") as Platform;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let platform: Platform = "other";
  let best = -1;
  for (const [p, c] of counts) {
    if (p !== "other" && c > best) {
      platform = p;
      best = c;
    }
  }
  if (best < 0 && counts.size > 0) platform = "other";

  // Merge fee items by name; re-compute percentage off the combined grossSales
  const map = new Map<string, FeeItem>();
  for (const r of results) {
    for (const f of r.feeItems ?? []) {
      const key = f.name.trim();
      const prev = map.get(key);
      if (prev) prev.amount += Number(f.amount) || 0;
      else
        map.set(key, {
          name: key,
          amount: Number(f.amount) || 0,
          percentage: 0,
        });
    }
  }
  const feeItems = Array.from(map.values()).map((f) => ({
    ...f,
    percentage: grossSales > 0 ? (f.amount / grossSales) * 100 : 0,
  }));

  return { labelPrice, grossSales, totalFees, netAmount, feeItems, platform };
}

/** Re-derive each fee item's percentage from its amount + the result's
 *  grossSales. Used after the seller edits any fee row so the displayed
 *  share-of-revenue stays in sync without a round-trip to the AI. */
export function recomputePercentages(r: AnalysisResult): AnalysisResult {
  return {
    ...r,
    feeItems: r.feeItems.map((f) => ({
      ...f,
      percentage: r.grossSales > 0 ? (f.amount / r.grossSales) * 100 : 0,
    })),
  };
}
