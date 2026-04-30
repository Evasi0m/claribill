import { describe, expect, it } from "vitest";
import {
  DEFAULT_COST_RATE,
  defaultPlatformRates,
  rateFor,
} from "./platform";

describe("defaultPlatformRates", () => {
  it("seeds every platform at DEFAULT_COST_RATE", () => {
    const rates = defaultPlatformRates();
    expect(rates.shopee).toBe(DEFAULT_COST_RATE);
    expect(rates.lazada).toBe(DEFAULT_COST_RATE);
    expect(rates.tiktok).toBe(DEFAULT_COST_RATE);
    expect(rates.other).toBe(DEFAULT_COST_RATE);
  });
});

describe("rateFor", () => {
  const rates = {
    shopee: 60,
    lazada: 55,
    tiktok: 50,
    other: 58,
  };

  it("returns the matching platform's rate", () => {
    expect(rateFor(rates, "shopee")).toBe(60);
    expect(rateFor(rates, "lazada")).toBe(55);
    expect(rateFor(rates, "tiktok")).toBe(50);
  });

  it("returns the `other` rate when platform is undefined", () => {
    expect(rateFor(rates, undefined)).toBe(58);
  });

  it("falls back to `other` when the matched value is out of range", () => {
    expect(rateFor({ ...rates, shopee: 0 }, "shopee")).toBe(58);
    expect(rateFor({ ...rates, shopee: 100 }, "shopee")).toBe(58);
    expect(rateFor({ ...rates, shopee: NaN }, "shopee")).toBe(58);
  });
});
