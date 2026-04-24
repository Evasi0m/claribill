import type { HistoryEntry } from "../components/types";
import {
  DEFAULT_COST_RATE,
  defaultPlatformRates,
  type PlatformRates,
} from "./platform";

export const STORAGE_KEYS = {
  apiKey: "CLARIBILL_API_KEY",
  costRate: "CLARIBILL_COST_RATE",
  platformRates: "CLARIBILL_PLATFORM_RATES",
  theme: "CLARIBILL_THEME",
  history: "CLARIBILL_HISTORY",
} as const;

const HISTORY_LIMIT = 200;

/* ---------------- Cost rate (legacy single rate, kept for defaults) ---------------- */

export function loadCostRate(): number {
  if (typeof window === "undefined") return DEFAULT_COST_RATE;
  const v = Number(localStorage.getItem(STORAGE_KEYS.costRate));
  return Number.isFinite(v) && v > 0 && v < 100 ? v : DEFAULT_COST_RATE;
}

export function saveCostRate(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.costRate, String(v));
}

/* ---------------- Per-platform cost rates ---------------- */

export function loadPlatformRates(): PlatformRates {
  if (typeof window === "undefined") return defaultPlatformRates();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.platformRates);
    if (!raw) {
      // First-time migration: seed from legacy single rate
      const legacy = loadCostRate();
      const rates = defaultPlatformRates();
      (Object.keys(rates) as (keyof PlatformRates)[]).forEach((k) => {
        rates[k] = legacy;
      });
      return rates;
    }
    const parsed = JSON.parse(raw) as Partial<PlatformRates>;
    const base = defaultPlatformRates();
    return { ...base, ...parsed } as PlatformRates;
  } catch {
    return defaultPlatformRates();
  }
}

export function savePlatformRates(rates: PlatformRates) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.platformRates, JSON.stringify(rates));
}

/* ---------------- Theme ---------------- */

export type Theme = "light" | "dark";

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEYS.theme);
  return v === "dark" ? "dark" : "light";
}

export function saveTheme(t: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.theme, t);
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
}

/* ---------------- History ---------------- */

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveHistory(list: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  const trimmed = list.slice(0, HISTORY_LIMIT);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(trimmed));
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()];
  saveHistory(next);
  return next;
}

export function updateHistory(id: string, patch: Partial<HistoryEntry>): HistoryEntry[] {
  const next = loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e));
  saveHistory(next);
  return next;
}

export function removeHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.history);
}

export function newHistoryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
