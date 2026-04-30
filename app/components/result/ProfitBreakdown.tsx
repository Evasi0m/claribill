"use client";

import { Package, Tag, Wallet } from "lucide-react";
import { EditableNumber } from "./Editable";

/** Three-row breakdown of how netAmount becomes profit:
 *  ราคาป้าย (editable) → ต้นทุน (derived) → ยอดสุทธิรับเข้า (from result). */
export function ProfitBreakdown({
  labelPrice,
  cost,
  netAmount,
  costRate,
  fmt,
  onEditLabelPrice,
}: {
  labelPrice: number;
  cost: number;
  netAmount: number;
  costRate: number;
  fmt: (n: number) => string;
  onEditLabelPrice: (v: number) => void;
}) {
  return (
    <div className="card overflow-hidden animate-slide-up">
      <div
        className="flex items-center gap-2 px-4 sm:px-5 py-3"
        style={{ borderBottom: "1px solid var(--border-soft)" }}
      >
        <div
          className="control-icon shrink-0"
          style={{
            width: 26,
            height: 26,
            backgroundColor: "color-mix(in oklab, var(--terracotta) 12%, transparent)",
            color: "var(--terracotta)",
          }}
        >
          <Package size={13} />
        </div>
        <h2
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          ที่มาของกำไร
        </h2>
      </div>
      <ul
        className="divide-y"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <BreakdownRow
          icon={<Tag size={12} />}
          iconColor="var(--info)"
          iconBg="color-mix(in oklab, var(--info) 15%, transparent)"
          label="ราคาป้าย"
          value={
            <EditableNumber
              value={labelPrice}
              valuePrefix="฿"
              onCommit={onEditLabelPrice}
              fmt={fmt}
              style={{ color: "var(--text-primary)", fontWeight: 500 }}
            />
          }
        />
        <BreakdownRow
          icon={<Package size={12} />}
          iconColor="var(--charcoal-warm)"
          iconBg="color-mix(in oklab, var(--warm-sand) 80%, transparent)"
          label={`ต้นทุน (−${costRate}%)`}
          value={
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              −฿{fmt(cost)}
            </span>
          }
        />
        <BreakdownRow
          icon={<Wallet size={12} />}
          iconColor="var(--terracotta)"
          iconBg="color-mix(in oklab, var(--terracotta) 12%, transparent)"
          label="ยอดสุทธิรับเข้า"
          value={
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              ฿{fmt(netAmount)}
            </span>
          }
        />
      </ul>
    </div>
  );
}

function BreakdownRow({
  icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
      <div
        className="control-icon shrink-0"
        style={{ width: 24, height: 24, backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <span
        className="text-sm min-w-0 flex-1"
        style={{ color: "var(--charcoal-warm)", overflowWrap: "anywhere" }}
      >
        {label}
      </span>
      <span className="text-sm shrink-0 text-right tabular-nums">{value}</span>
    </li>
  );
}
