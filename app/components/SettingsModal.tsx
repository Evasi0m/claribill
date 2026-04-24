"use client";

import { useState } from "react";
import { X, Trash2, RefreshCw, KeyRound, Percent } from "lucide-react";

interface Props {
  onClose: () => void;
  onClearKey: () => void;
  costRate: number;
  onCostRateChange: (v: number) => void;
}

export default function SettingsModal({
  onClose,
  onClearKey,
  costRate,
  onCostRateChange,
}: Props) {
  const [rate, setRate] = useState<string>(String(costRate));

  const commitRate = () => {
    const n = Number(rate);
    if (Number.isFinite(n) && n > 0 && n < 100) {
      onCostRateChange(n);
    } else {
      setRate(String(costRate));
    }
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
        className="glass-strong w-full max-w-sm p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div
              className="control-icon glass-primary"
              style={{ width: 32, height: 32 }}
            >
              <KeyRound size={14} />
            </div>
            <h2
              className="text-lg font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
            >
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="control-icon glass-chip"
            style={{ color: "var(--stone-gray)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Cost rate */}
        <div className="glass-chip p-4 mb-3">
          <label
            htmlFor="costRate"
            className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
            style={{ color: "var(--charcoal-warm)" }}
          >
            <Percent size={12} style={{ color: "var(--terracotta)" }} />
            อัตราต้นทุน (หักจากราคาป้าย)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="costRate"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              step={1}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onBlur={commitRate}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="input-glass"
              style={{ flex: 1 }}
            />
            <span
              className="control-sm glass-chip shrink-0"
              style={{ color: "var(--stone-gray)" }}
            >
              %
            </span>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--stone-gray)" }}>
            ตัวอย่าง: ราคาป้าย ฿6,900 − {Number(rate) || 0}% ={" "}
            <span style={{ color: "var(--charcoal-warm)", fontWeight: 500 }}>
              ฿{(6900 * (1 - (Number(rate) || 0) / 100)).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        {/* API Key section */}
        <div className="glass-chip p-4 mb-4">
          <p className="text-xs font-medium mb-1.5" style={{ color: "var(--charcoal-warm)" }}>
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
