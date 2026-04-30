"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Pencil,
} from "lucide-react";
import type { HistoryEntry, Platform } from "./types";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "../lib/platform";
import { historyToCsv, downloadFile } from "../lib/export";
import { fmtLongDate, fmtMoney, todayFilename } from "../lib/format";
import { useModal } from "../lib/useModal";

interface Props {
  entries: HistoryEntry[];
  onClose: () => void;
  onOpen: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onClearAll: () => void;
}

const fmt = fmtMoney;

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

type DateRange = "all" | "today" | "7d" | "30d" | "thisMonth" | "lastMonth";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "today", label: "วันนี้" },
  { value: "7d", label: "7 วัน" },
  { value: "30d", label: "30 วัน" },
  { value: "thisMonth", label: "เดือนนี้" },
  { value: "lastMonth", label: "เดือนที่แล้ว" },
];

function inDateRange(ts: number, range: DateRange, now: Date): boolean {
  if (range === "all") return true;
  const d = new Date(ts);
  if (range === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (range === "7d") {
    return now.getTime() - ts <= 7 * 24 * 60 * 60 * 1000;
  }
  if (range === "30d") {
    return now.getTime() - ts <= 30 * 24 * 60 * 60 * 1000;
  }
  if (range === "thisMonth") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (range === "lastMonth") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
  }
  return true;
}

export default function HistoryModal({
  entries,
  onClose,
  onOpen,
  onDelete,
  onEditTitle,
  onClearAll,
}: Props) {
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && (e.result.platform ?? "other") !== filter) return false;
      if (!inDateRange(e.createdAt, dateRange, now)) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, dateRange, query]);

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

  const panelRef = useModal(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{
        backgroundColor: "rgba(20,20,19,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ประวัติการวิเคราะห์"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="glass-strong w-full max-w-xl animate-scale-in flex flex-col"
        style={{ maxHeight: "92vh", outline: "none" }}
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
              style={{ color: "var(--text-primary)" }}
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

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-warm)",
              borderRadius: "var(--radius)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-tertiary)" }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาในชื่อบิล..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้นหา"
                className="press-shrink"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date range chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_RANGES.map((r) => (
              <FilterChip
                key={r.value}
                label={r.label}
                active={dateRange === r.value}
                onClick={() => setDateRange(r.value)}
              />
            ))}
          </div>

          {/* Platform filter chips */}
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
              className="card p-8 text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Archive
                size={28}
                className="mx-auto mb-2"
                style={{ color: "var(--stone-gray)" }}
              />
              {entries.length === 0 ? (
                <>
                  <p className="text-sm">ยังไม่มีประวัติ</p>
                  <p className="text-xs mt-1">วิเคราะห์สลิปเพื่อเริ่มสะสมประวัติ</p>
                </>
              ) : (
                <>
                  <p className="text-sm">ไม่พบรายการที่ตรงกับตัวกรอง</p>
                  <p className="text-xs mt-1">ลองเปลี่ยนคำค้นหาหรือช่วงวันที่</p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((e, idx) => (
                <li
                  key={e.id}
                  className="card p-3 animate-fade-in"
                  style={{ animationDelay: `${Math.min(idx * 0.03, 0.4)}s` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail (when persisted) — falls back to a platform
                        color swatch for older entries that have no images. */}
                    {e.thumbnails && e.thumbnails.length > 0 ? (
                      <div
                        className="shrink-0 relative"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "calc(var(--radius) - 8px)",
                          overflow: "hidden",
                          border: "1px solid var(--border-warm)",
                          backgroundColor: "var(--warm-sand)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={e.thumbnails[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {e.thumbnails.length > 1 && (
                          <span
                            className="absolute bottom-0 right-0 text-[9px] px-1 leading-tight font-medium"
                            style={{
                              backgroundColor: "rgba(20,20,19,0.7)",
                              color: "var(--ivory)",
                              borderTopLeftRadius: "calc(var(--radius) - 12px)",
                            }}
                          >
                            +{e.thumbnails.length - 1}
                          </span>
                        )}
                        <span
                          aria-hidden
                          className="absolute top-1 left-1 rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            backgroundColor: e.result.platform
                              ? PLATFORM_COLORS[e.result.platform]
                              : PLATFORM_COLORS.other,
                            boxShadow: "0 0 0 1.5px rgba(255,255,255,0.85)",
                          }}
                        />
                      </div>
                    ) : (
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
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EditableTitle
                          value={e.title}
                          onCommit={(v) => onEditTitle(e.id, v)}
                        />
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
                        {fmtLongDate(e.createdAt)} • {e.imageCount} รูป • ต้นทุน {e.costRate}%
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
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
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

function EditableTitle({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-medium bg-transparent outline-none min-w-0 flex-1"
        style={{
          color: "var(--text-primary)",
          borderBottom: "1px solid var(--terracotta)",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="group flex items-center gap-1 text-left min-w-0 truncate press-shrink"
      title="แก้ไขชื่อ"
    >
      <span
        className="text-sm font-medium truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
        style={{ color: "var(--text-tertiary)" }}
      />
    </button>
  );
}

