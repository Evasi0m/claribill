import type { HistoryEntry } from "../components/types";
import {
  loadHistory,
  loadPlatformRates,
  loadTheme,
  saveHistory,
  savePlatformRates,
  saveTheme,
  type Theme,
} from "./storage";
import { defaultPlatformRates, type PlatformRates } from "./platform";

/** Versioned bundle of everything Claribill keeps in localStorage *except*
 *  the API key — that's intentionally excluded so a backup file can be
 *  shared/synced without leaking credentials. Bumping `version` lets us
 *  migrate older bundles in importBackup() without throwing. */
export interface BackupBundle {
  version: 1;
  exportedAt: number;
  platformRates: PlatformRates;
  theme: Theme;
  history: HistoryEntry[];
}

export function buildBackup(): BackupBundle {
  return {
    version: 1,
    exportedAt: Date.now(),
    platformRates: loadPlatformRates(),
    theme: loadTheme(),
    history: loadHistory(),
  };
}

/** Apply a parsed bundle to localStorage. Throws on malformed input — the
 *  caller decides whether to surface the message or wrap it. We don't merge
 *  history with existing entries; the seller chose to restore, so we
 *  replace. */
export function applyBackup(bundle: unknown): {
  history: HistoryEntry[];
  platformRates: PlatformRates;
  theme: Theme;
} {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("ไฟล์ backup ไม่ถูกต้อง");
  }
  const b = bundle as Partial<BackupBundle>;
  if (b.version !== 1) {
    throw new Error(`ไม่รองรับ backup version ${String(b.version)}`);
  }
  const history = Array.isArray(b.history) ? b.history : [];
  const platformRates = b.platformRates
    ? { ...defaultPlatformRates(), ...b.platformRates }
    : defaultPlatformRates();
  const theme: Theme = b.theme === "dark" ? "dark" : "light";

  saveHistory(history);
  savePlatformRates(platformRates);
  saveTheme(theme);
  return { history, platformRates, theme };
}
