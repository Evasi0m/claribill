"use client";

import { Plus, ReceiptText, X } from "lucide-react";
import type { FeeItem } from "../types";
import { EditableNumber, EditableText } from "./Editable";

/** Per-fee breakdown — name, amount, share-of-fees bar, share-of-sales %.
 *  Always renders (even with 0 items) so the seller can add a fee the AI
 *  missed. AI-extracted items are immutable in shape (you can edit name and
 *  amount, but not delete); user-added rows are flagged userAdded and get
 *  a delete button. */
export function FeeTable({
  items,
  grossSales,
  fmt,
  onEdit,
  onAdd,
  onRemove,
}: {
  items: FeeItem[];
  grossSales: number;
  fmt: (n: number) => string;
  onEdit: (index: number, patch: Partial<FeeItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const sortedWithIndex = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => b.item.amount - a.item.amount);
  const total = items.reduce((s, i) => s + i.amount, 0);
  const totalSalesPct = grossSales > 0 ? (total / grossSales) * 100 : 0;
  const hasItems = items.length > 0;

  return (
    <div className="card overflow-hidden animate-slide-up">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border-soft)" }}
      >
        <div
          className="control-icon shrink-0"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "color-mix(in oklab, var(--danger) 14%, transparent)",
            color: "var(--danger)",
          }}
        >
          <ReceiptText size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-sm sm:text-base font-medium leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            รายละเอียดค่าธรรมเนียม
          </h2>
          <p
            className="text-[11px] tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            {hasItems
              ? `${items.length} รายการ · รวม ${totalSalesPct.toFixed(2)}% ของยอดขาย`
              : "ยังไม่มีรายการ — เพิ่มเองได้ถ้า AI ตกหล่น"}
          </p>
        </div>
      </div>

      {/* Rows — mobile-first stacked layout: name + amount on top, bar + %
          underneath. Bar length = item amount as a share of total fees, so
          the heaviest fee fills the bar and the rest are visibly relative. */}
      {hasItems && (
        <ul className="px-3 sm:px-4 py-2">
          {sortedWithIndex.map(({ item, originalIndex }, i) => {
            const ofTotalPct = total > 0 ? (item.amount / total) * 100 : 0;
            const salesPct =
              item.percentage ||
              (grossSales > 0 ? (item.amount / grossSales) * 100 : 0);
            const isZero = item.amount === 0;
            return (
              <li
                key={`fee-${originalIndex}`}
                className="animate-fade-in py-2.5"
                style={{
                  animationDelay: `${0.15 + i * 0.04}s`,
                  borderTop:
                    i === 0
                      ? undefined
                      : "1px solid color-mix(in oklab, var(--border-soft) 60%, transparent)",
                }}
              >
                <div className="flex items-baseline gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <EditableText
                      value={item.name}
                      onCommit={(v) => onEdit(originalIndex, { name: v })}
                      className="text-sm leading-snug"
                      style={{
                        color: "var(--text-primary)",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    />
                    {item.userAdded && (
                      <span
                        className="text-[10px] mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            "color-mix(in oklab, var(--info) 14%, transparent)",
                          color: "var(--info)",
                        }}
                      >
                        <Plus size={9} />
                        เพิ่มเอง
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm sm:text-base font-medium whitespace-nowrap tabular-nums shrink-0"
                    style={{ color: isZero ? "var(--text-tertiary)" : "var(--danger)" }}
                  >
                    <EditableNumber
                      value={item.amount}
                      valuePrefix="฿"
                      onCommit={(v) => onEdit(originalIndex, { amount: v })}
                      fmt={fmt}
                      valueColor={isZero ? "var(--text-tertiary)" : "var(--danger)"}
                    />
                  </div>
                  {item.userAdded && (
                    <button
                      onClick={() => onRemove(originalIndex)}
                      aria-label={`ลบ ${item.name}`}
                      className="control-icon shrink-0 press-shrink"
                      style={{
                        width: 24,
                        height: 24,
                        color: "var(--text-tertiary)",
                        backgroundColor: "transparent",
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    className="relative h-1.5 rounded-full flex-1 overflow-hidden"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--warm-sand) 65%, transparent)",
                    }}
                  >
                    {ofTotalPct > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-full animate-bar-grow"
                        style={{
                          width: `${ofTotalPct}%`,
                          background:
                            "linear-gradient(90deg, var(--danger), color-mix(in oklab, var(--danger) 65%, var(--terracotta-2)))",
                        }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[11px] tabular-nums shrink-0"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isZero ? "—" : `${salesPct.toFixed(2)}% ของยอดขาย`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add row button */}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1.5 px-4 sm:px-5 py-3 text-sm press-shrink"
        style={{
          color: "var(--terracotta)",
          backgroundColor: "color-mix(in oklab, var(--terracotta) 5%, transparent)",
          borderTop: hasItems ? "1px solid var(--border-soft)" : undefined,
          borderBottom: hasItems ? undefined : "1px solid var(--border-soft)",
        }}
      >
        <Plus size={14} />
        เพิ่มรายการค่าธรรมเนียม
      </button>

      {/* Total row */}
      <div
        className="flex items-center gap-3 px-4 sm:px-5 py-3"
        style={{
          borderTop: "1px solid var(--border-soft)",
          backgroundColor: "color-mix(in oklab, var(--warm-sand) 35%, transparent)",
        }}
      >
        <span
          className="text-sm font-medium flex-1"
          style={{ color: "var(--charcoal-warm)" }}
        >
          รวมค่าธรรมเนียมทั้งหมด
        </span>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {totalSalesPct.toFixed(2)}%
        </span>
        <span
          className="text-base font-medium whitespace-nowrap tabular-nums"
          style={{ color: "var(--danger)" }}
        >
          ฿{fmt(total)}
        </span>
      </div>
    </div>
  );
}
