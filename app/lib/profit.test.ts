import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../components/types";
import { basisOf, computeCost, computeProfit } from "./profit";

const slip = (overrides: Partial<AnalysisResult>): AnalysisResult => ({
  grossSales: 1000,
  totalFees: 100,
  netAmount: 900,
  feeItems: [],
  ...overrides,
});

describe("basisOf", () => {
  it("returns labelPrice when set", () => {
    expect(basisOf(slip({ grossSales: 1000, labelPrice: 1500 }))).toBe(1500);
  });

  it("falls back to grossSales when labelPrice is undefined", () => {
    expect(basisOf(slip({ grossSales: 1000 }))).toBe(1000);
  });

  it("respects an explicit zero labelPrice", () => {
    // `??` only falls back on null/undefined, so a 0 labelPrice (degenerate
    // but possible from a buggy slip) is treated as authoritative.
    expect(basisOf(slip({ grossSales: 1000, labelPrice: 0 }))).toBe(0);
  });
});

describe("computeCost", () => {
  it("returns basis × (1 − costRate%)", () => {
    expect(computeCost(1000, 58)).toBeCloseTo(420, 5);
  });

  it("guards against costRate <= 0", () => {
    expect(computeCost(1000, 0)).toBe(0);
    expect(computeCost(1000, -10)).toBe(0);
  });

  it("guards against costRate >= 100", () => {
    expect(computeCost(1000, 100)).toBe(0);
    expect(computeCost(1000, 150)).toBe(0);
  });

  it("guards against non-finite costRate", () => {
    expect(computeCost(1000, NaN)).toBe(0);
    expect(computeCost(1000, Infinity)).toBe(0);
  });
});

describe("computeProfit", () => {
  it("derives all four numbers in one shot", () => {
    const result = computeProfit(slip({
      grossSales: 1000,
      labelPrice: 1500,
      netAmount: 900,
    }), 58);
    expect(result.basis).toBe(1500);
    expect(result.cost).toBeCloseTo(630, 5);     // 1500 * 0.42
    expect(result.profit).toBeCloseTo(270, 5);   // 900 - 630
    expect(result.marginPct).toBeCloseTo(18, 5); // 270 / 1500 * 100
  });

  it("uses grossSales as basis when labelPrice missing", () => {
    const result = computeProfit(slip({
      grossSales: 1000,
      netAmount: 900,
    }), 58);
    expect(result.basis).toBe(1000);
    expect(result.cost).toBeCloseTo(420, 5);
    expect(result.profit).toBeCloseTo(480, 5);
  });

  it("returns 0 marginPct when basis is 0", () => {
    const result = computeProfit(slip({
      grossSales: 0,
      labelPrice: 0,
      netAmount: 0,
    }), 58);
    expect(result.marginPct).toBe(0);
  });

  it("can return negative profit when fees + cost exceed inflows", () => {
    const result = computeProfit(slip({
      grossSales: 1000,
      labelPrice: 1500,
      netAmount: 100,
    }), 58);
    expect(result.profit).toBeCloseTo(-530, 5);
    expect(result.marginPct).toBeLessThan(0);
  });
});
