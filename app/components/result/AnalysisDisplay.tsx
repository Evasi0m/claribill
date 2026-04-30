"use client";

import {
  BarChart3,
  Download,
  FileImage,
  Save,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { AnalysisResult, FeeItem, Platform } from "../types";
import { BigCard, HeroCard, SmallCard } from "./Cards";
import { FeeTable } from "./FeeTable";
import { LabelPriceNotice } from "./LabelPriceNotice";
import { PlatformPicker } from "./PlatformPicker";
import { ProfitBreakdown } from "./ProfitBreakdown";

/** Composes the entire result page: toolbar (platform picker + export +
 *  saved chip), tag-price prompt, bento metrics, profit breakdown, and the
 *  fee table. State lives one level up in Dashboard so handlers can also
 *  persist edits to history. */
export function AnalysisDisplay({
  result,
  fmt,
  costRate,
  labelPrice,
  cost,
  profit,
  onUpdateResult,
  onUpdateFeeItem,
  onAddFeeItem,
  onRemoveFeeItem,
  onChangePlatform,
  onExportCsv,
  onExportPng,
  saved,
}: {
  result: AnalysisResult;
  fmt: (n: number) => string;
  costRate: number;
  labelPrice: number;
  cost: number;
  profit: number;
  onUpdateResult: (patch: Partial<AnalysisResult>) => void;
  onUpdateFeeItem: (index: number, patch: Partial<FeeItem>) => void;
  onAddFeeItem: () => void;
  onRemoveFeeItem: (index: number) => void;
  onChangePlatform: (p: Platform) => void;
  onExportCsv: () => void;
  onExportPng: () => void;
  saved: boolean;
}) {
  const feeRate = result.grossSales > 0 ? (result.totalFees / result.grossSales) * 100 : 0;
  const marginPct = labelPrice > 0 ? (profit / labelPrice) * 100 : 0;
  const profitPositive = profit >= 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <PlatformPicker
          value={result.platform ?? "other"}
          onChange={onChangePlatform}
        />
        <div className="flex-1" />
        {saved && (
          <span
            className="control-sm glass-chip"
            style={{ color: "var(--success)" }}
            title="บันทึกในประวัติอัตโนมัติ"
          >
            <Save size={12} />
            บันทึกแล้ว
          </span>
        )}
        <button
          onClick={onExportCsv}
          className="control-sm glass-chip"
          style={{ color: "var(--charcoal-warm)" }}
          aria-label="Export CSV"
        >
          <Download size={12} />
          CSV
        </button>
        <button
          onClick={onExportPng}
          className="control-sm glass-chip"
          style={{ color: "var(--charcoal-warm)" }}
          aria-label="Export Image"
        >
          <FileImage size={12} />
          รูปภาพ
        </button>
      </div>

      {/* Tag-price prompt — Shopee/Lazada bills omit the pre-discount price,
          so labelPrice falls back to grossSales and the cost basis is wrong
          unless the seller fills it in. */}
      <LabelPriceNotice
        platform={result.platform ?? "other"}
        labelPrice={result.labelPrice ?? result.grossSales}
        grossSales={result.grossSales}
        fmt={fmt}
        onCommit={(v) => onUpdateResult({ labelPrice: v })}
      />

      {/* Bento grid — mobile-first: profit hero on top, then sales/net pair,
          then fees full-width. On sm+ profit and gross share a row, fees and
          net share the next, keeping the 4-column rhythm. */}
      <div
        className="grid gap-3 sm:gap-4"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <div className="col-span-4 animate-slide-up stagger-1">
          <HeroCard
            label="กำไรโดยประมาณ"
            value={profit}
            valuePrefix={profitPositive ? "฿" : "−฿"}
            valueAbs
            valueColor={profitPositive ? "var(--success-bright)" : "var(--danger-bright)"}
            marginPct={marginPct}
            costRate={costRate}
            cost={cost}
            fmt={fmt}
            profitPositive={profitPositive}
          />
        </div>

        <div className="col-span-4 sm:col-span-2 animate-slide-up stagger-2">
          <BigCard
            icon={<BarChart3 size={18} />}
            iconBg="color-mix(in oklab, var(--info) 18%, transparent)"
            iconColor="var(--info)"
            label="ยอดขายรวม"
            value={result.grossSales}
            valuePrefix="฿"
            onCommit={(v) => onUpdateResult({ grossSales: v })}
            sub={
              result.labelPrice && result.labelPrice !== result.grossSales
                ? `ราคาป้าย ฿${fmt(result.labelPrice)}`
                : undefined
            }
          />
        </div>

        <div className="col-span-4 sm:col-span-2 animate-slide-up stagger-3">
          <BigCard
            icon={<Wallet size={18} />}
            iconBg="color-mix(in oklab, var(--terracotta) 18%, transparent)"
            iconColor="var(--terracotta)"
            label="ยอดสุทธิรับเข้า"
            value={result.netAmount}
            valuePrefix="฿"
            valueColor="var(--terracotta)"
            onCommit={(v) => onUpdateResult({ netAmount: v })}
            sub="หลังหักค่าธรรมเนียม"
          />
        </div>

        <div className="col-span-4 animate-slide-up stagger-4">
          <SmallCard
            icon={<TrendingDown size={16} />}
            iconBg="color-mix(in oklab, var(--danger) 15%, transparent)"
            iconColor="var(--danger)"
            label="ค่าธรรมเนียมรวม"
            value={result.totalFees}
            valuePrefix="฿"
            valueColor="var(--danger)"
            sub={`${feeRate.toFixed(2)}% ของยอดขาย`}
            onCommit={(v) => onUpdateResult({ totalFees: v })}
          />
        </div>
      </div>

      {/* Profit breakdown */}
      <ProfitBreakdown
        labelPrice={labelPrice}
        cost={cost}
        netAmount={result.netAmount}
        costRate={costRate}
        fmt={fmt}
        onEditLabelPrice={(v) => onUpdateResult({ labelPrice: v })}
      />

      {/* Fee Table — always rendered so the seller can add fees the AI
          missed even on bills where it returned an empty list. */}
      <FeeTable
        items={result.feeItems ?? []}
        grossSales={result.grossSales}
        fmt={fmt}
        onEdit={onUpdateFeeItem}
        onAdd={onAddFeeItem}
        onRemove={onRemoveFeeItem}
      />
    </div>
  );
}
