"use client";

import { useState } from "react";
import {
  X,
  Trash2,
  RefreshCw,
  KeyRound,
  Percent,
  Sun,
  Moon,
  Store,
} from "lucide-react";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  DEFAULT_COST_RATE,
  type PlatformRates,
} from "../lib/platform";
import type { Theme } from "../lib/storage";
import type { Platform } from "./types";

interface Props {
  onClose: () => void;
  onClearKey: () => void;
  platformRates: PlatformRates;
  onPlatformRatesChange: (r: PlatformRates) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export default function SettingsModal({
  onClose,
  onClearKey,
  platformRates,
  onPlatformRatesChange,
  theme,
  onThemeChange,
}: Props) {
  const [drafts, setDrafts] = useState<Record<Platform, string>>(
    () =>
      Object.fromEntries(PLATFORMS.map((p) => [p, String(platformRates[p])])) as Record<
        Platform,
        string
      >,
  );

  const commitRate = (p: Platform) => {
    const n = Number(drafts[p]);
    if (Number.isFinite(n) && n > 0 && n < 100) {
      onPlatformRatesChange({ ...platformRates, [p]: n });
    } else {
      setDrafts((d) => ({ ...d, [p]: String(platformRates[p]) }));
    }
  };

  const resetAll = () => {
    const reset: PlatformRates = {
      shopee: DEFAULT_COST_RATE,
      lazada: DEFAULT_COST_RATE,
      tiktok: DEFAULT_COST_RATE,
      other: DEFAULT_COST_RATE,
    };
    onPlatformRatesChange(reset);
    setDrafts(
      Object.fromEntries(PLATFORMS.map((p) => [p, String(reset[p])])) as Record<Platform, string>,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{
        backgroundColor: "rgba(20,20,19,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md p-6 animate-scale-in max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="control-icon glass-primary"
              style={{ width: 32, height: 32 }}
            >
              <KeyRound size={14} />
            </div>
            <h2
              className="text-lg font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--text-primary)" }}
            >
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="control-icon glass-chip"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Theme toggle */}
        <div className="glass-chip p-4 mb-3">
          <p
            className="text-xs font-medium mb-2.5"
            style={{ color: "var(--charcoal-warm)" }}
          >
            ธีม
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ThemeChip
              label="Light"
              icon={<Sun size={14} />}
              active={theme === "light"}
              onClick={() => onThemeChange("light")}
            />
            <ThemeChip
              label="Dark"
              icon={<Moon size={14} />}
              active={theme === "dark"}
              onClick={() => onThemeChange("dark")}
            />
          </div>
        </div>

        {/* Per-platform cost rates */}
        <div className="glass-chip p-4 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Percent size={12} style={{ color: "var(--terracotta)" }} />
              <p
                className="text-xs font-medium"
                style={{ color: "var(--charcoal-warm)" }}
              >
                ต้นทุน % ต่อแพลตฟอร์ม
              </p>
            </div>
            <button
              onClick={resetAll}
              className="text-[11px] underline underline-offset-2 press-shrink"
              style={{ color: "var(--stone-gray)" }}
            >
              คืนค่าเริ่มต้น ({DEFAULT_COST_RATE}%)
            </button>
          </div>
          <p
            className="text-[11px] mb-3"
            style={{ color: "var(--stone-gray)" }}
          >
            ต้นทุนสินค้าหักจากราคาป้ายก่อนคำนวณกำไร — ตั้งได้แยกแต่ละแพลตฟอร์ม
          </p>
          <div className="space-y-2">
            {PLATFORMS.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 flex-1 min-w-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span
                    className="inline-block rounded-full shrink-0"
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: PLATFORM_COLORS[p],
                    }}
                  />
                  <Store size={12} style={{ color: "var(--stone-gray)" }} />
                  <span className="text-sm truncate">{PLATFORM_LABELS[p]}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    step={1}
                    value={drafts[p]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [p]: e.target.value }))
                    }
                    onBlur={() => commitRate(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="input-glass"
                    style={{
                      width: 72,
                      height: 36,
                      padding: "0 10px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--stone-gray)" }}
                  >
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p
            className="text-[11px] mt-3"
            style={{ color: "var(--stone-gray)" }}
          >
            ตัวอย่าง: ราคาป้าย ฿6,900 − {platformRates.other}% ={" "}
            <span
              style={{ color: "var(--text-primary)", fontWeight: 500 }}
            >
              ฿
              {(6900 * (1 - platformRates.other / 100)).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        </div>

        {/* API Key section */}
        <div className="glass-chip p-4 mb-4">
          <p
            className="text-xs font-medium mb-1.5"
            style={{ color: "var(--charcoal-warm)" }}
          >
            API Key ปัจจุบัน
          </p>
          <p
            className="text-xs font-mono tracking-wider"
            style={{ color: "var(--stone-gray)" }}
          >
            ••••••••••••••••••••••••••••••••
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onClearKey}
            className="control glass-danger-solid w-full"
          >
            <Trash2 size={14} />
            ลบ API Key และออกจากระบบ
          </button>
          <button
            onClick={onClose}
            className="control glass-chip w-full"
            style={{ color: "var(--charcoal-warm)" }}
          >
            <RefreshCw size={14} />
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`control ${active ? "glass-primary" : "glass-chip"}`}
      style={{
        width: "100%",
        color: active ? "var(--ivory)" : "var(--charcoal-warm)",
        height: 40,
      }}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
