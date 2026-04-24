"use client";

import { useMemo, useState } from "react";
import {
  X,
  History as HistoryIcon,
  Trash2,
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Archive,
} from "lucide-react";
import type { HistoryEntry, Platform } from "./types";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "../lib/platform";
import { historyToCsv, downloadFile, todayFilename } from "../lib/export";

interface Props {
  entries: HistoryEntry[];
  onClose: () => void;
  onOpen: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

type Totals = {
  sales: number;
  fees: number;
  net: number;
  profit: number;
  count: number;
  feeRate: number;
};

function totalsOf(entries: HistoryEntry[]): Totals {
  const sales = entries.reduce((s, e) => s + e.result.grossSales, 0);
  const fees = entries.reduce((s, e) => s + e.result.totalFees, 0);
  const net = entries.reduce((s, e) => s + e.result.netAmount, 0);
  const profit = entries.reduce((s, e) => s + e.profit, 0);
  return {
    sales,
    fees,
    net,
    profit,
    count: entries.length,
    feeRate: sales > 0 ? (fees / sales) * 100 : 0,
  };
}

export default function HistoryModal({
  entries,
  onClose,
  onOpen,
  onDelete,
  onClearAll,
}: Props) {
  const [filter, setFilter] = useState<Platform | "all">("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((e) => (e.result.platform ?? "other") === filter),
    [entries, filter],
  );

  // Month-over-month comparison (current vs previous calendar month)
  const now = new Date();
  const thisKey = monthKey(now.getTime());
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prevDate.getTime());

  const thisMonth = useMemo(
    () => totalsOf(entries.filter((e) => monthKey(e.createdAt) === thisKey)),
    [entries, thisKey],
  );
  const prevMonth = useMemo(
    () => totalsOf(entries.filter((e) => monthKey(e.createdAt) === prevKey)),
    [entries, prevKey],
  );

  const exportAll = () => {
    if (entries.length === 0) return;
    downloadFile(
      todayFilename("claribill-history", "csv"),
      historyToCsv(entries),
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
        className="glass-strong w-full max-w-xl animate-scale-in flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 p-5 pb-3"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="control-icon glass-primary"
              style={{ width: 32, height: 32 }}
            >
              <HistoryIcon size={14} />
            </div>
            <h2
              className="text-lg font-medium truncate"
              style={{ fontFamily: "Georgia, serif", color: "var(--text-primary)" }}
            >
              ประวัติการวิเคราะห์
            </h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: "color-mix(in oklab, var(--warm-sand) 70%, transparent)",
                color: "var(--text-tertiary)",
              }}
            >
              {entries.length}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="control-icon glass-chip shrink-0"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 pt-3 space-y-4">
          {/* Month-over-month */}
          {(thisMonth.count > 0 || prevMonth.count > 0) && (
            <ComparisonCard
              thisLabel={monthLabel(thisKey)}
              prevLabel={monthLabel(prevKey)}
              thisTotals={thisMonth}
              prevTotals={prevMonth}
            />
          )}

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip
              label="ทั้งหมด"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {(["shopee", "lazada", "tiktok", "other"] as Platform[]).map((p) => (
              <FilterChip
                key={p}
                label={PLATFORM_LABELS[p]}
                color={PLATFORM_COLORS[p]}
                active={filter === p}
                onClick={() => setFilter(p)}
              />
            ))}
          </div>

          {/* Entries */}
          {filtered.length === 0 ? (
            <div
              className="glass-chip p-8 text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Archive
                size={28}
                className="mx-auto mb-2"
                style={{ color: "var(--stone-gray)" }}
              />
              <p className="text-sm">ยังไม่มีประวัติ</p>
              <p className="text-xs mt-1">วิเคราะห์สลิปเพื่อเริ่มสะสมประวัติ</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((e, idx) => (
                <li
                  key={e.id}
                  className="glass p-3 animate-fade-in"
                  style={{ animationDelay: `${Math.min(idx * 0.03, 0.4)}s` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Platform swatch */}
                    <div
                      className="shrink-0 rounded-full mt-1"
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: e.result.platform
                          ? PLATFORM_COLORS[e.result.platform]
                          : PLATFORM_COLORS.other,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {e.title}
                        </p>
                        {e.result.platform && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${PLATFORM_COLORS[e.result.platform]}22`,
                              color: PLATFORM_COLORS[e.result.platform],
                            }}
                          >
                            {PLATFORM_LABELS[e.result.platform]}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {fmtDate(e.createdAt)} • {e.imageCount} รูป • ต้นทุน {e.costRate}%
                      </p>
                      <div
                        className="mt-2 grid gap-x-3 gap-y-0.5 text-xs"
                        style={{
                          gridTemplateColumns: "auto 1fr auto",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span>ยอดขาย</span>
                        <span />
                        <span
                          className="text-right tabular-nums font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          ฿{fmt(e.result.grossSales)}
                        </span>
                        <span>ค่าธรรมเนียม</span>
                        <span />
                        <span
                          className="text-right tabular-nums"
                          style={{ color: "var(--danger)" }}
                        >
                          −฿{fmt(e.result.totalFees)}
                        </span>
                        <span>กำไร</span>
                        <span />
                        <span
                          className="text-right tabular-nums font-medium"
                          style={{
                            color:
                              e.profit >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {e.profit >= 0 ? "฿" : "−฿"}
                          {fmt(Math.abs(e.profit))}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpen(e)}
                        aria-label="เปิดรายการนี้"
                        className="control-icon glass-chip"
                        style={{
                          width: 30,
                          height: 30,
                          color: "var(--terracotta)",
                        }}
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(e.id)}
                        aria-label="ลบรายการนี้"
                        className="control-icon glass-chip"
                        style={{
                          width: 30,
                          height: 30,
                          color: "var(--danger)",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-2 p-4"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button
            onClick={exportAll}
            disabled={entries.length === 0}
            className="control glass-chip flex-1"
            style={{
              color: "var(--charcoal-warm)",
              opacity: entries.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => {
              if (entries.length === 0) return;
              if (confirm("ลบประวัติทั้งหมด? ไม่สามารถกู้คืนได้")) onClearAll();
            }}
            disabled={entries.length === 0}
            className="control glass-chip"
            style={{
              color: "var(--danger)",
              opacity: entries.length === 0 ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
            ล้างทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`control-sm ${active ? "" : "glass-chip"}`}
      style={{
        backgroundColor: active ? "var(--text-primary)" : undefined,
        color: active ? "var(--surface)" : "var(--text-secondary)",
        borderRadius: "var(--radius-pill)",
        height: 28,
        padding: "0 12px",
      }}
    >
      {color && (
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

function ComparisonCard({
  thisLabel,
  prevLabel,
  thisTotals,
  prevTotals,
}: {
  thisLabel: string;
  prevLabel: string;
  thisTotals: Totals;
  prevTotals: Totals;
}) {
  const metrics: {
    label: string;
    curr: number;
    prev: number;
    kind: "money" | "pct";
    goodWhen: "up" | "down";
  }[] = [
    { label: "ยอดขาย", curr: thisTotals.sales, prev: prevTotals.sales, kind: "money", goodWhen: "up" },
    { label: "กำไร", curr: thisTotals.profit, prev: prevTotals.profit, kind: "money", goodWhen: "up" },
    { label: "% ค่าธรรมเนียม", curr: thisTotals.feeRate, prev: prevTotals.feeRate, kind: "pct", goodWhen: "down" },
  ];

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm font-medium"
          style={{ fontFamily: "Georgia, serif", color: "var(--text-primary)" }}
        >
          เปรียบเทียบเดือน
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {thisLabel} vs {prevLabel}
        </p>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => (
          <MetricRow key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  curr,
  prev,
  kind,
  goodWhen,
}: {
  label: string;
  curr: number;
  prev: number;
  kind: "money" | "pct";
  goodWhen: "up" | "down";
}) {
  const delta = curr - prev;
  const pctChange = prev !== 0 ? (delta / Math.abs(prev)) * 100 : curr === 0 ? 0 : 100;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const isGood =
    direction === "flat"
      ? null
      : (direction === "up" && goodWhen === "up") ||
        (direction === "down" && goodWhen === "down");
  const color =
    isGood === null
      ? "var(--text-tertiary)"
      : isGood
        ? "var(--success)"
        : "var(--danger)";
  const arrow =
    direction === "up" ? (
      <TrendingUp size={12} />
    ) : direction === "down" ? (
      <TrendingDown size={12} />
    ) : (
      <Minus size={12} />
    );

  const formatValue = (v: number) =>
    kind === "money" ? `฿${fmt(v)}` : `${v.toFixed(2)}%`;

  return (
    <div
      className="grid items-center gap-2"
      style={{ gridTemplateColumns: "1fr auto auto" }}
    >
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span
        className="text-sm font-medium tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {formatValue(curr)}
      </span>
      <span
        className="text-[11px] flex items-center gap-1 tabular-nums"
        style={{ color }}
      >
        {arrow}
        {direction === "flat"
          ? "±0"
          : `${delta > 0 ? "+" : ""}${pctChange.toFixed(1)}%`}
      </span>
    </div>
  );
}

