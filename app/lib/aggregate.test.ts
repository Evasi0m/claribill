import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../components/types";
import { aggregate, recomputePercentages } from "./aggregate";

const slip = (overrides: Partial<AnalysisResult>): AnalysisResult => ({
  grossSales: 1000,
  totalFees: 100,
  netAmount: 900,
  feeItems: [],
  ...overrides,
});

describe("aggregate", () => {
  it("sums money fields across slips", () => {
    const result = aggregate([
      slip({ grossSales: 1000, totalFees: 100, netAmount: 900 }),
      slip({ grossSales: 500, totalFees: 50, netAmount: 450 }),
    ]);
    expect(result.grossSales).toBe(1500);
    expect(result.totalFees).toBe(150);
    expect(result.netAmount).toBe(1350);
  });

  it("falls back to grossSales when no labelPrice provided", () => {
    const result = aggregate([slip({ grossSales: 1000 })]);
    expect(result.labelPrice).toBe(1000);
  });

  it("uses summed labelPrice when at least one slip has it", () => {
    const result = aggregate([
      slip({ grossSales: 1000, labelPrice: 1500 }),
      slip({ grossSales: 500, labelPrice: 700 }),
    ]);
    expect(result.labelPrice).toBe(2200);
  });

  it("treats non-numeric values as zero", () => {
    const result = aggregate([
      slip({ grossSales: 1000, totalFees: NaN, netAmount: 900 }),
    ]);
    expect(result.totalFees).toBe(0);
  });

  it("picks the dominant non-`other` platform", () => {
    const result = aggregate([
      slip({ platform: "shopee" }),
      slip({ platform: "shopee" }),
      slip({ platform: "tiktok" }),
    ]);
    expect(result.platform).toBe("shopee");
  });

  it("falls back to `other` when all slips are `other`", () => {
    const result = aggregate([
      slip({ platform: "other" }),
      slip({ platform: "other" }),
    ]);
    expect(result.platform).toBe("other");
  });

  it("merges fee items by name and recomputes percentages", () => {
    const result = aggregate([
      slip({
        grossSales: 1000,
        feeItems: [
          { name: "ค่าคอมมิชชั่น", amount: 50, percentage: 0 },
          { name: "ค่าธรรมเนียม", amount: 30, percentage: 0 },
        ],
      }),
      slip({
        grossSales: 1000,
        feeItems: [
          { name: "ค่าคอมมิชชั่น", amount: 70, percentage: 0 },
        ],
      }),
    ]);
    const commission = result.feeItems.find((f) => f.name === "ค่าคอมมิชชั่น");
    expect(commission?.amount).toBe(120);
    // Combined grossSales is 2000, so 120/2000 = 6%.
    expect(commission?.percentage).toBeCloseTo(6, 5);
  });

  it("trims whitespace when matching fee item names", () => {
    const result = aggregate([
      slip({
        feeItems: [{ name: "ค่าคอมมิชชั่น  ", amount: 50, percentage: 0 }],
      }),
      slip({
        feeItems: [{ name: "ค่าคอมมิชชั่น", amount: 50, percentage: 0 }],
      }),
    ]);
    expect(result.feeItems).toHaveLength(1);
    expect(result.feeItems[0].amount).toBe(100);
  });

  it("handles an empty input list without throwing", () => {
    const result = aggregate([]);
    expect(result.grossSales).toBe(0);
    expect(result.platform).toBe("other");
    expect(result.feeItems).toEqual([]);
  });
});

describe("recomputePercentages", () => {
  it("derives each fee's share-of-grossSales", () => {
    const result = recomputePercentages({
      grossSales: 1000,
      totalFees: 200,
      netAmount: 800,
      feeItems: [
        { name: "a", amount: 100, percentage: 0 },
        { name: "b", amount: 50, percentage: 0 },
      ],
    });
    expect(result.feeItems[0].percentage).toBe(10);
    expect(result.feeItems[1].percentage).toBe(5);
  });

  it("returns 0% when grossSales is 0 (avoids divide-by-zero)", () => {
    const result = recomputePercentages({
      grossSales: 0,
      totalFees: 0,
      netAmount: 0,
      feeItems: [{ name: "a", amount: 10, percentage: 99 }],
    });
    expect(result.feeItems[0].percentage).toBe(0);
  });

  it("preserves the userAdded flag", () => {
    const result = recomputePercentages({
      grossSales: 1000,
      totalFees: 50,
      netAmount: 950,
      feeItems: [
        { name: "extra", amount: 50, percentage: 0, userAdded: true },
      ],
    });
    expect(result.feeItems[0].userAdded).toBe(true);
  });
});
