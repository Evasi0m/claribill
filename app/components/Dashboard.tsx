"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Upload,
  Settings,
  X,
  TrendingDown,
  Wallet,
  ReceiptText,
  BarChart3,
  ImageIcon,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Tag,
  Package,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import type { AnalysisResult } from "./types";

interface Props {
  apiKey: string;
  onClearKey: () => void;
}

const AI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

const isRetryableError = (msg: string) =>
  msg.includes("429") ||
  msg.includes("quota") ||
  msg.includes("Quota") ||
  msg.includes("RESOURCE_EXHAUSTED") ||
  msg.includes("prepayment credits") ||
  msg.includes("404") ||
  msg.includes("not found") ||
  msg.includes("not supported") ||
  msg.includes("500") ||
  msg.includes("503");

const PROMPT = `จงอ่านภาพใบแจ้งยอดขายสินค้าออนไลน์ และคืนค่าเป็น JSON เท่านั้น (ไม่ต้องมีข้อความอื่น) ที่ประกอบด้วย:
{
  "labelPrice": <ยอดรวมสินค้าก่อนหักส่วนลด (ราคาป้ายเต็ม) เป็นตัวเลข — หาบรรทัดที่เขียนว่า "ยอดรวมสินค้าก่อนหักส่วนลด" หรือคำใกล้เคียง หากไม่มีให้ใช้ค่าเดียวกับ grossSales>,
  "grossSales": <ยอดขายหลังหักส่วนลดจากผู้ขาย (ยอดที่ลูกค้าจ่ายจริงก่อนหักค่าธรรมเนียม) เป็นตัวเลข>,
  "totalFees": <ยอดรวมค่าธรรมเนียมทั้งหมด เป็นตัวเลข บวกเสมอ (ไม่ติดลบ)>,
  "netAmount": <ยอดเงินสุทธิที่ผู้ขายได้รับหลังหักค่าธรรมเนียม เป็นตัวเลข>,
  "feeItems": [
    { "name": <ชื่อรายการ>, "amount": <จำนวนเงิน เป็นตัวเลข บวกเสมอ>, "percentage": <เปอร์เซ็นต์เมื่อเทียบกับ grossSales เป็นตัวเลข> }
  ]
}`;

const COST_RATE_KEY = "CLARIBILL_COST_RATE";
const DEFAULT_COST_RATE = 58;

function loadCostRate(): number {
  if (typeof window === "undefined") return DEFAULT_COST_RATE;
  const v = Number(localStorage.getItem(COST_RATE_KEY));
  return Number.isFinite(v) && v > 0 && v < 100 ? v : DEFAULT_COST_RATE;
}

export default function Dashboard({ apiKey, onClearKey }: Props) {
  const [dragging, setDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(AI_MODELS[0]);
  const [costRate, setCostRate] = useState<number>(DEFAULT_COST_RATE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCostRate(loadCostRate());
  }, []);

  const handleCostRateChange = (v: number) => {
    setCostRate(v);
    localStorage.setItem(COST_RATE_KEY, String(v));
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageData({ base64, mimeType: file.type });
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleAnalyze = async () => {
    if (!imageData) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const genAI = new GoogleGenerativeAI(apiKey);
    const imagePart = {
      inlineData: {
        data: imageData.base64,
        mimeType: imageData.mimeType,
      },
    };

    let lastError: unknown = null;

    for (const modelName of AI_MODELS) {
      try {
        setActiveModel(modelName);
        const model = genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent([PROMPT, imagePart]);
        const text = response.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("ไม่พบข้อมูล JSON ในผลลัพธ์");

        const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);
        setResult(parsed);
        setLoading(false);
        return;
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) break;
        if (!isRetryableError(msg)) break;
      }
    }

    const msg = lastError instanceof Error ? lastError.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
      setError("API Key ไม่ถูกต้อง กรุณาตรวจสอบและอัปเดตใน Settings");
    } else if (isRetryableError(msg)) {
      setError(
        `ลองทุกโมเดลแล้วไม่สำเร็จ (${AI_MODELS.join(", ")}) — โควต้าหมดหรือโมเดลไม่พร้อมใช้งาน กรุณารอสักครู่ เปลี่ยน API key หรือเปิด billing ใน Google AI Studio\n\nรายละเอียด: ${msg}`,
      );
    } else {
      setError(`วิเคราะห์ไม่สำเร็จ: ${msg}`);
    }
    setLoading(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--parchment)" }}>
      {/* Ambient gradient orbs (subtle background for glass to blur over) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 -left-20 w-72 h-72 rounded-full opacity-40 animate-pulse-soft"
          style={{ background: "radial-gradient(circle, rgba(201,100,66,0.25), transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(217,119,87,0.2), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(232,230,220,0.6), transparent 70%)" }}
        />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-20 px-4 py-3 glass" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <h1
            className="text-lg sm:text-xl font-medium shrink-0 flex items-center gap-2"
            style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
          >
            <span
              className="control-icon glass-primary"
              style={{ width: 32, height: 32 }}
            >
              <Sparkles size={14} />
            </span>
            Claribill
          </h1>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="control-sm glass-chip truncate max-w-[110px] sm:max-w-[200px]"
              style={{ color: "var(--stone-gray)" }}
              title={activeModel}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: loading ? "var(--terracotta)" : "var(--success)" }}
              />
              <span className="truncate">{activeModel}</span>
            </span>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="control-icon glass-chip"
              style={{ color: "var(--charcoal-warm)" }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </nav>

      <main className="relative max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-5 sm:space-y-6">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="glass cursor-pointer transition-all duration-300 animate-slide-up overflow-hidden"
          style={{
            minHeight: 200,
            borderStyle: "dashed",
            borderColor: dragging
              ? "var(--terracotta)"
              : "color-mix(in oklab, var(--border-warm) 80%, transparent)",
            borderWidth: 2,
            transform: dragging ? "scale(1.01)" : "scale(1)",
            boxShadow: dragging
              ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 12px 40px rgba(201,100,66,0.2)"
              : undefined,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {imagePreview ? (
            <div className="relative p-3 sm:p-4 animate-scale-in">
              <img
                src={imagePreview}
                alt="สลิปที่อัปโหลด"
                className="max-h-60 sm:max-h-72 mx-auto object-contain"
                style={{ borderRadius: "calc(var(--radius) - 4px)" }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                  setImageData(null);
                  setResult(null);
                  setError(null);
                }}
                aria-label="ลบรูป"
                className="control-icon absolute top-4 right-4"
                style={{
                  backgroundColor: "rgba(20,20,19,0.75)",
                  backdropFilter: "blur(8px)",
                  color: "var(--warm-silver)",
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 sm:py-14 px-4">
              <div
                className={`glass-chip flex items-center justify-center ${dragging ? "" : "animate-pulse-soft"}`}
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: dragging
                    ? "color-mix(in oklab, var(--terracotta) 15%, transparent)"
                    : undefined,
                  transition: "background-color 0.25s ease",
                }}
              >
                <ImageIcon
                  size={24}
                  style={{ color: dragging ? "var(--terracotta)" : "var(--olive-gray)" }}
                />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm" style={{ color: "var(--charcoal-warm)" }}>
                  {dragging ? "วางได้เลย!" : "แตะเพื่อเลือก หรือลากรูปมาวาง"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--stone-gray)" }}>
                  รองรับ JPG, PNG, WEBP
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Analyze Button — primary action, strongest color */}
        {imageData && !loading && (
          <button
            onClick={handleAnalyze}
            className="control glass-primary w-full animate-slide-up animate-glow-pulse"
            style={{ height: 52 }}
          >
            <Upload size={16} />
            วิเคราะห์สลิป
          </button>
        )}

        {/* Loading */}
        {loading && <LoadingPanel modelName={activeModel} />}

        {/* Error */}
        {error && <ErrorPanel message={error} />}

        {/* Results */}
        {result && <AnalysisDisplay result={result} fmt={fmt} costRate={costRate} />}
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onClearKey={onClearKey}
          costRate={costRate}
          onCostRateChange={handleCostRateChange}
        />
      )}
    </div>
  );
}

function LoadingPanel({ modelName }: { modelName: string }) {
  return (
    <div className="glass shimmer-overlay flex items-center gap-3 p-4 animate-scale-in">
      <div
        className="control-icon glass-primary shrink-0"
        style={{ width: 40, height: 40 }}
      >
        <Loader2 size={18} className="animate-spin-slow" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--charcoal-warm)" }}>
          กำลังวิเคราะห์...
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--stone-gray)" }}>
          {modelName}
        </p>
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 200;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="glass-danger overflow-hidden animate-slide-down">
      <div className="flex items-start gap-3 p-4">
        <div
          className="control-icon shrink-0 animate-bounce-in"
          style={{
            backgroundColor: "rgba(181,51,51,0.15)",
            color: "var(--danger)",
          }}
        >
          <AlertCircle size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--danger)" }}>
            เกิดข้อผิดพลาด
          </p>
          <div
            className="text-sm overflow-hidden transition-all duration-300"
            style={{
              color: "#8a2828",
              maxHeight: expanded || !isLong ? "1200px" : "4.5rem",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            {message}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={copy}
              className="control-sm"
              style={{
                backgroundColor: copied
                  ? "color-mix(in oklab, var(--success) 15%, transparent)"
                  : "color-mix(in oklab, var(--danger) 12%, transparent)",
                color: copied ? "var(--success)" : "var(--danger)",
                border: `1px solid ${copied ? "color-mix(in oklab, var(--success) 35%, transparent)" : "color-mix(in oklab, var(--danger) 28%, transparent)"}`,
              }}
              aria-label="คัดลอก error"
            >
              {copied ? (
                <>
                  <Check size={12} className="animate-bounce-in" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <Copy size={12} />
                  คัดลอก
                </>
              )}
            </button>
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="control-sm"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--danger)",
                  border: "1px solid color-mix(in oklab, var(--danger) 28%, transparent)",
                }}
              >
                <ChevronDown
                  size={12}
                  style={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease",
                  }}
                />
                {expanded ? "ย่อ" : "ดูทั้งหมด"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisDisplay({
  result,
  fmt,
  costRate,
}: {
  result: AnalysisResult;
  fmt: (n: number) => string;
  costRate: number;
}) {
  const feeRate = result.grossSales > 0 ? (result.totalFees / result.grossSales) * 100 : 0;

  // Profit: cost = labelPrice × (1 − costRate%). Profit = netAmount − cost.
  const labelPrice = result.labelPrice ?? result.grossSales;
  const cost = labelPrice * (1 - costRate / 100);
  const profit = result.netAmount - cost;
  const marginPct = labelPrice > 0 ? (profit / labelPrice) * 100 : 0;
  const profitPositive = profit >= 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="animate-slide-up stagger-1">
          <SummaryCard
            icon={<BarChart3 size={18} />}
            iconBg="color-mix(in oklab, var(--info) 18%, transparent)"
            iconColor="var(--info)"
            label="ยอดขายรวม"
            value={`฿${fmt(result.grossSales)}`}
          />
        </div>
        <div className="animate-slide-up stagger-2">
          <SummaryCard
            icon={<TrendingDown size={18} />}
            iconBg="color-mix(in oklab, var(--danger) 15%, transparent)"
            iconColor="var(--danger)"
            label="ค่าธรรมเนียมรวม"
            value={`฿${fmt(result.totalFees)}`}
            sub={`${feeRate.toFixed(2)}% ของยอดขาย`}
            warn
          />
        </div>
        <div className="animate-slide-up stagger-3">
          <SummaryCard
            icon={<Wallet size={18} />}
            iconBg="rgba(255,255,255,0.1)"
            iconColor="var(--terracotta-2)"
            label="ยอดสุทธิ"
            value={`฿${fmt(result.netAmount)}`}
            accent
          />
        </div>
      </div>

      {/* Profit Panel */}
      <ProfitPanel
        labelPrice={labelPrice}
        cost={cost}
        netAmount={result.netAmount}
        profit={profit}
        marginPct={marginPct}
        costRate={costRate}
        positive={profitPositive}
        fmt={fmt}
      />

      {/* Fee Breakdown */}
      {result.feeItems && result.feeItems.length > 0 && (
        <div className="glass overflow-hidden animate-slide-up stagger-4">
          <div
            className="flex items-center gap-2 px-4 sm:px-5 py-3.5"
            style={{ borderBottom: "1px solid color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
          >
            <div
              className="control-icon shrink-0"
              style={{
                width: 28,
                height: 28,
                backgroundColor: "color-mix(in oklab, var(--terracotta) 12%, transparent)",
                color: "var(--terracotta)",
              }}
            >
              <ReceiptText size={14} />
            </div>
            <h2
              className="text-sm sm:text-base font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
            >
              รายละเอียดค่าธรรมเนียม
            </h2>
          </div>

          {/* Mobile: card list */}
          <ul
            className="sm:hidden divide-y"
            style={{ borderColor: "color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
          >
            {result.feeItems.map((item, i) => (
              <li
                key={i}
                className="px-4 py-3 animate-fade-in"
                style={{ animationDelay: `${0.3 + i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span
                    className="text-sm font-medium break-words min-w-0"
                    style={{ color: "var(--near-black)", overflowWrap: "anywhere" }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-sm font-medium shrink-0"
                    style={{ color: "var(--danger)" }}
                  >
                    ฿{fmt(item.amount)}
                  </span>
                </div>
                <PercentBar value={item.percentage} />
              </li>
            ))}
          </ul>

          {/* Tablet+ table */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "color-mix(in oklab, var(--warm-sand) 50%, transparent)" }}>
                <th className="text-left px-5 py-2.5 font-medium" style={{ color: "var(--charcoal-warm)" }}>
                  รายการ
                </th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: "var(--charcoal-warm)" }}>
                  จำนวนเงิน
                </th>
                <th className="text-right px-5 py-2.5 font-medium" style={{ color: "var(--charcoal-warm)" }}>
                  % ของยอดขาย
                </th>
              </tr>
            </thead>
            <tbody>
              {result.feeItems.map((item, i) => (
                <tr
                  key={i}
                  className="animate-fade-in"
                  style={{
                    borderTop: "1px solid color-mix(in oklab, var(--border-cream) 80%, transparent)",
                    animationDelay: `${0.3 + i * 0.05}s`,
                  }}
                >
                  <td className="px-5 py-3" style={{ color: "var(--near-black)", overflowWrap: "anywhere" }}>
                    {item.name}
                  </td>
                  <td className="px-5 py-3 text-right" style={{ color: "var(--danger)" }}>
                    ฿{fmt(item.amount)}
                  </td>
                  <td className="px-5 py-3 text-right" style={{ color: "var(--olive-gray)" }}>
                    <PercentBar value={item.percentage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`${accent ? "glass-accent" : "glass"} p-4 sm:p-5 transition-transform hover:-translate-y-0.5`}
    >
      <div
        className="control-icon mb-2.5"
        style={{
          width: 36,
          height: 36,
          backgroundColor: accent ? "rgba(255,255,255,0.08)" : iconBg,
          color: accent ? "var(--terracotta-2)" : iconColor,
        }}
      >
        {icon}
      </div>
      <p
        className="text-xs mb-1"
        style={{ color: accent ? "var(--warm-silver)" : "var(--stone-gray)" }}
      >
        {label}
      </p>
      <p
        className="text-lg sm:text-xl font-medium break-words"
        style={{
          fontFamily: "Georgia, serif",
          color: accent ? "var(--ivory)" : warn ? "var(--danger)" : "var(--near-black)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: accent ? "var(--warm-silver)" : "var(--stone-gray)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function PercentBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center justify-end gap-2 w-full">
      <div
        className="flex-1 sm:w-16 sm:flex-none max-w-[160px] h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "color-mix(in oklab, var(--warm-sand) 80%, transparent)" }}
      >
        <div
          className="h-full rounded-full animate-bar-grow"
          style={{
            width: `${clamped}%`,
            background: "linear-gradient(90deg, var(--terracotta-2), var(--terracotta))",
          }}
        />
      </div>
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--olive-gray)", minWidth: "3rem", textAlign: "right" }}
      >
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

function ProfitPanel({
  labelPrice,
  cost,
  netAmount,
  profit,
  marginPct,
  costRate,
  positive,
  fmt,
}: {
  labelPrice: number;
  cost: number;
  netAmount: number;
  profit: number;
  marginPct: number;
  costRate: number;
  positive: boolean;
  fmt: (n: number) => string;
}) {
  const accentColor = positive ? "var(--success)" : "var(--danger)";
  const accentBg = positive
    ? "color-mix(in oklab, var(--success) 12%, transparent)"
    : "color-mix(in oklab, var(--danger) 12%, transparent)";

  return (
    <div className="glass overflow-hidden animate-slide-up stagger-4">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 sm:px-5 py-3.5"
        style={{ borderBottom: "1px solid color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
      >
        <div
          className="control-icon shrink-0"
          style={{
            width: 28,
            height: 28,
            backgroundColor: accentBg,
            color: accentColor,
          }}
        >
          <TrendingUp size={14} />
        </div>
        <h2
          className="text-sm sm:text-base font-medium"
          style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
        >
          กำไรโดยประมาณ
        </h2>
        <span
          className="ml-auto text-[11px] px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "color-mix(in oklab, var(--warm-sand) 70%, transparent)",
            color: "var(--stone-gray)",
            border: "1px solid color-mix(in oklab, var(--border-warm) 80%, transparent)",
          }}
        >
          ต้นทุน −{costRate}%
        </span>
      </div>

      {/* Big profit number */}
      <div className="px-4 sm:px-5 pt-4 pb-3">
        <p className="text-xs" style={{ color: "var(--stone-gray)" }}>
          กำไรสุทธิ
        </p>
        <p
          className="text-2xl sm:text-3xl font-medium mt-0.5 break-words animate-bounce-in"
          style={{
            fontFamily: "Georgia, serif",
            color: accentColor,
            overflowWrap: "anywhere",
          }}
        >
          {profit >= 0 ? "฿" : "−฿"}
          {fmt(Math.abs(profit))}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--stone-gray)" }}>
          อัตรากำไร {marginPct.toFixed(2)}% ของราคาป้าย
        </p>
      </div>

      {/* Breakdown rows */}
      <ul
        className="divide-y"
        style={{ borderColor: "color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
      >
        <ProfitRow
          icon={<Tag size={13} />}
          iconColor="var(--info)"
          iconBg="color-mix(in oklab, var(--info) 15%, transparent)"
          label="ราคาป้าย"
          value={`฿${fmt(labelPrice)}`}
        />
        <ProfitRow
          icon={<Package size={13} />}
          iconColor="var(--charcoal-warm)"
          iconBg="color-mix(in oklab, var(--warm-sand) 80%, transparent)"
          label={`ต้นทุน (ราคาป้าย − ${costRate}%)`}
          value={`−฿${fmt(cost)}`}
          valueColor="var(--charcoal-warm)"
        />
        <ProfitRow
          icon={<Wallet size={13} />}
          iconColor="var(--terracotta)"
          iconBg="color-mix(in oklab, var(--terracotta) 12%, transparent)"
          label="ยอดสุทธิรับเข้า"
          value={`฿${fmt(netAmount)}`}
        />
      </ul>
    </div>
  );
}

function ProfitRow({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-2.5 animate-fade-in">
      <div
        className="control-icon shrink-0"
        style={{ width: 26, height: 26, backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <span
        className="text-sm min-w-0 flex-1"
        style={{ color: "var(--charcoal-warm)", overflowWrap: "anywhere" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-medium shrink-0"
        style={{ color: valueColor ?? "var(--near-black)" }}
      >
        {value}
      </span>
    </li>
  );
}
