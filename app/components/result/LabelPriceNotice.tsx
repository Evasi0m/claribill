"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import type { Platform } from "../types";
import { PLATFORM_LABELS } from "../../lib/platform";

/** Surfaces an input for Shopee/Lazada bills, where the slip only shows
 *  the post-discount price. Without the original tag price the cost basis
 *  (labelPrice × (1 − costRate%)) is computed off the wrong number and the
 *  resulting profit understates margin. */
export function LabelPriceNotice({
  platform,
  labelPrice,
  grossSales,
  fmt,
  onCommit,
}: {
  platform: Platform;
  labelPrice: number;
  grossSales: number;
  fmt: (n: number) => string;
  onCommit: (n: number) => void;
}) {
  const needsTagPrice = platform === "shopee" || platform === "lazada";
  const isUnset = labelPrice <= grossSales;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // Sync draft from parent when not actively editing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(labelPrice > grossSales ? String(labelPrice) : "");
  }, [labelPrice, grossSales, editing]);

  if (!needsTagPrice) return null;

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onCommit(n);
    setEditing(false);
  };

  return (
    <div className="card animate-slide-up p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className="control-icon shrink-0"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "color-mix(in oklab, var(--info) 15%, transparent)",
            color: "var(--info)",
          }}
        >
          <Tag size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {isUnset ? "ใส่ราคาป้ายสินค้า" : "ราคาป้ายสินค้า"}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--charcoal-warm)", overflowWrap: "anywhere" }}
          >
            บิล {PLATFORM_LABELS[platform]} ไม่แสดงราคาป้ายเต็ม — ใส่ราคาป้ายเพื่อคำนวณต้นทุนได้ถูกต้อง
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className="text-sm tabular-nums shrink-0"
              style={{ color: "var(--charcoal-warm)" }}
            >
              ฿
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={draft}
              onFocus={() => setEditing(true)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setDraft(labelPrice > grossSales ? String(labelPrice) : "");
                  setEditing(false);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder={`มากกว่า ${fmt(grossSales)}`}
              className="input-glass tabular-nums"
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
