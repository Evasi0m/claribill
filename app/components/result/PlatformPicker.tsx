"use client";

import { useState } from "react";
import { Store, ChevronDown, Check } from "lucide-react";
import type { Platform } from "../types";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "../../lib/platform";

/** Lets the seller correct the AI's platform detection. The detected
 *  platform drives the cost-rate selection and the Shopee/Lazada-specific
 *  tag-price prompt, so getting it right matters. */
export function PlatformPicker({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Platform[] = ["shopee", "lazada", "tiktok", "other"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="control-sm glass-chip"
        style={{ color: "var(--charcoal-warm)" }}
      >
        <Store size={12} style={{ color: PLATFORM_COLORS[value] }} />
        {PLATFORM_LABELS[value]}
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 z-30 glass-strong p-1 animate-slide-down"
            style={{ minWidth: 150 }}
          >
            {options.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 hover:opacity-80"
                style={{
                  color: p === value ? "var(--terracotta)" : "var(--text-primary)",
                  backgroundColor:
                    p === value
                      ? "color-mix(in oklab, var(--terracotta) 12%, transparent)"
                      : "transparent",
                  borderRadius: "calc(var(--radius) - 8px)",
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: PLATFORM_COLORS[p],
                  }}
                />
                {PLATFORM_LABELS[p]}
                {p === value && <Check size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
