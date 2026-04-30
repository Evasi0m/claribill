"use client";

import { TrendingUp } from "lucide-react";
import { fmtMoney } from "../../lib/format";
import { EditableNumber } from "./Editable";

/** Hero profit card — full-width, dark gradient, headline number for the
 *  whole result page. */
export function HeroCard({
  label,
  value,
  valuePrefix,
  valueAbs,
  valueColor,
  marginPct,
  costRate,
  cost,
  fmt,
  profitPositive,
}: {
  label: string;
  value: number;
  valuePrefix?: string;
  valueAbs?: boolean;
  valueColor?: string;
  marginPct: number;
  costRate: number;
  cost: number;
  fmt: (n: number) => string;
  profitPositive: boolean;
}) {
  const display = valueAbs ? Math.abs(value) : value;
  return (
    <div className="card-hero p-5 sm:p-7">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="control-icon"
          style={{
            width: 28,
            height: 28,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: profitPositive ? "var(--success-bright)" : "var(--danger-bright)",
          }}
        >
          <TrendingUp size={14} />
        </div>
        <p
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--warm-silver)" }}
        >
          {label}
        </p>
      </div>
      <div
        className="text-3xl sm:text-4xl font-medium break-words leading-tight tabular-nums"
        style={{ color: valueColor ?? "var(--ivory)", overflowWrap: "anywhere" }}
      >
        {valuePrefix}
        {fmt(display)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full tabular-nums"
          style={{
            backgroundColor: profitPositive
              ? "rgba(122, 217, 154, 0.16)"
              : "rgba(255, 122, 108, 0.18)",
            color: profitPositive ? "var(--success-bright)" : "var(--danger-soft)",
          }}
        >
          {marginPct >= 0 ? "+" : ""}
          {marginPct.toFixed(2)}% margin
        </span>
        <span style={{ color: "var(--warm-silver)" }}>
          ต้นทุน −{costRate}% = ฿{fmt(cost)}
        </span>
      </div>
    </div>
  );
}

/** Tall metric card — used for gross sales and net amount. */
export function BigCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valuePrefix,
  valueAbs,
  valueColor,
  sub,
  onCommit,
  readOnly,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  valuePrefix?: string;
  valueAbs?: boolean;
  valueColor?: string;
  sub?: string;
  onCommit?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5 h-full transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="control-icon shrink-0"
          style={{ width: 32, height: 32, backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <p
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </p>
      </div>
      <div
        className="text-2xl sm:text-3xl font-medium break-words leading-tight tabular-nums"
        style={{
          color: valueColor ?? "var(--text-primary)",
          overflowWrap: "anywhere",
        }}
      >
        <EditableNumber
          value={value}
          valuePrefix={valuePrefix}
          valueAbs={valueAbs}
          valueColor={valueColor}
          onCommit={onCommit}
          readOnly={readOnly}
          fmt={fmtMoney}
        />
      </div>
      {sub && (
        <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Compact horizontal metric card — used for the totalFees summary row. */
export function SmallCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valuePrefix,
  valueColor,
  sub,
  onCommit,
  readOnly,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  valuePrefix?: string;
  valueColor?: string;
  sub?: string;
  onCommit?: (n: number) => void;
  readOnly?: boolean;
}) {
  const textColor = valueColor ?? "var(--text-primary)";
  return (
    <div className="card p-4 h-full flex items-center gap-3 transition-transform hover:-translate-y-0.5">
      <div
        className="control-icon shrink-0"
        style={{ width: 36, height: 36, backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] uppercase tracking-wide"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </p>
        <div
          className="text-lg sm:text-xl font-medium break-words leading-tight tabular-nums"
          style={{ color: textColor, overflowWrap: "anywhere" }}
        >
          <EditableNumber
            value={value}
            valuePrefix={valuePrefix}
            valueColor={textColor}
            onCommit={onCommit}
            readOnly={readOnly}
            fmt={fmtMoney}
          />
        </div>
        {sub && (
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
