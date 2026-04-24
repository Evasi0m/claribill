import type { Platform } from "../components/types";

export const PLATFORMS: Platform[] = ["shopee", "lazada", "tiktok", "other"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  other: "อื่นๆ",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  shopee: "#ee4d2d",
  lazada: "#0f146d",
  tiktok: "#111111",
  other: "#87867f",
};

export const DEFAULT_COST_RATE = 58;

export type PlatformRates = Record<Platform, number>;

export function defaultPlatformRates(): PlatformRates {
  return {
    shopee: DEFAULT_COST_RATE,
    lazada: DEFAULT_COST_RATE,
    tiktok: DEFAULT_COST_RATE,
    other: DEFAULT_COST_RATE,
  };
}

/** Decide the effective cost rate given detected platform. Falls back to `other`. */
export function rateFor(rates: PlatformRates, platform?: Platform): number {
  const p = (platform ?? "other") as Platform;
  const v = rates[p];
  return Number.isFinite(v) && v > 0 && v < 100 ? v : rates.other;
}
