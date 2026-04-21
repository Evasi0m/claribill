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
  "grossSales": <ยอดขายรวมก่อนหัก เป็นตัวเลข>,
  "totalFees": <ยอดรวมค่าธรรมเนียมทั้งหมด เป็นตัวเลข>,
  "netAmount": <ยอดเงินสุทธิ เป็นตัวเลข>,
  "feeItems": [
    { "name": <ชื่อรายการ>, "amount": <จำนวนเงิน เป็นตัวเลข>, "percentage": <เปอร์เซ็นต์เมื่อเทียบกับยอดขาย เป็นตัวเลข> }
  ]
}`;

export default function Dashboard({ apiKey, onClearKey }: Props) {
  const [dragging, setDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(AI_MODELS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="min-h-screen" style={{ backgroundColor: "var(--parchment)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 px-4 sm:px-6 py-3 backdrop-blur-md"
        style={{
          backgroundColor: "color-mix(in oklab, var(--ivory) 90%, transparent)",
          borderBottom: "1px solid var(--border-cream)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <h1
            className="text-lg sm:text-xl font-medium shrink-0 flex items-center gap-1.5"
            style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
          >
            <Sparkles size={16} style={{ color: "var(--terracotta)" }} className="animate-pulse-soft" />
            Claribill
          </h1>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center text-[10px] sm:text-xs px-2 py-1 rounded-lg truncate max-w-[110px] sm:max-w-[200px]"
              style={{
                backgroundColor: "var(--warm-sand)",
                color: "var(--stone-gray)",
                border: "1px solid var(--border-warm)",
              }}
              title={activeModel}
            >
              {activeModel}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm press-shrink transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--warm-sand)",
                color: "var(--charcoal-warm)",
                boxShadow: "0px 0px 0px 1px var(--border-warm)",
              }}
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-5 sm:space-y-8">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative rounded-2xl cursor-pointer transition-all duration-300 press-shrink animate-slide-up"
          style={{
            border: `2px dashed ${dragging ? "var(--terracotta)" : "var(--border-warm)"}`,
            backgroundColor: dragging ? "rgba(201,100,66,0.06)" : "var(--ivory)",
            minHeight: "180px",
            transform: dragging ? "scale(1.01)" : "scale(1)",
            boxShadow: dragging
              ? "0 8px 32px rgba(201,100,66,0.15)"
              : "0 2px 12px rgba(0,0,0,0.03)",
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
                className="max-h-60 sm:max-h-72 mx-auto rounded-xl object-contain"
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
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 rounded-full press-shrink hover:scale-110 transition-transform"
                style={{ backgroundColor: "var(--dark-surface)", color: "var(--warm-silver)" }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 sm:py-14 px-4">
              <div
                className={`p-4 rounded-2xl ${dragging ? "" : "animate-pulse-soft"}`}
                style={{
                  backgroundColor: dragging ? "rgba(201,100,66,0.12)" : "var(--warm-sand)",
                  transition: "background-color 0.25s ease",
                }}
              >
                <ImageIcon
                  size={28}
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

        {/* Analyze Button */}
        {imageData && !loading && (
          <button
            onClick={handleAnalyze}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 press-shrink animate-slide-up"
            style={{
              backgroundColor: "var(--terracotta)",
              color: "var(--ivory)",
              boxShadow: "0 4px 16px rgba(201,100,66,0.25)",
            }}
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
        {result && <AnalysisDisplay result={result} fmt={fmt} />}
      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onClearKey={onClearKey} />
      )}
    </div>
  );
}

function LoadingPanel({ modelName }: { modelName: string }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-2xl animate-scale-in shimmer-bg"
      style={{
        border: "1px solid var(--border-cream)",
      }}
    >
      <Loader2 size={20} className="animate-spin-slow shrink-0" style={{ color: "var(--terracotta)" }} />
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
    <div
      className="rounded-2xl overflow-hidden animate-slide-down"
      style={{
        backgroundColor: "rgba(181,51,51,0.06)",
        border: "1px solid rgba(181,51,51,0.22)",
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 animate-bounce-in"
          style={{ color: "#b53333" }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium mb-1" style={{ color: "#b53333" }}>
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium press-shrink transition-colors"
              style={{
                backgroundColor: copied ? "rgba(34,139,60,0.12)" : "rgba(181,51,51,0.1)",
                color: copied ? "#1f7a38" : "#b53333",
                border: `1px solid ${copied ? "rgba(34,139,60,0.3)" : "rgba(181,51,51,0.25)"}`,
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium press-shrink transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "#b53333",
                  border: "1px solid rgba(181,51,51,0.25)",
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
}: {
  result: AnalysisResult;
  fmt: (n: number) => string;
}) {
  const feeRate = result.grossSales > 0 ? (result.totalFees / result.grossSales) * 100 : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="animate-slide-up stagger-1">
          <SummaryCard
            icon={<BarChart3 size={18} />}
            label="ยอดขายรวม"
            value={`฿${fmt(result.grossSales)}`}
            accent={false}
          />
        </div>
        <div className="animate-slide-up stagger-2">
          <SummaryCard
            icon={<TrendingDown size={18} />}
            label="ค่าธรรมเนียมรวม"
            value={`฿${fmt(result.totalFees)}`}
            sub={`${feeRate.toFixed(2)}% ของยอดขาย`}
            accent={false}
            warn
          />
        </div>
        <div className="animate-slide-up stagger-3">
          <SummaryCard
            icon={<Wallet size={18} />}
            label="ยอดสุทธิ"
            value={`฿${fmt(result.netAmount)}`}
            accent
          />
        </div>
      </div>

      {/* Fee Breakdown */}
      {result.feeItems && result.feeItems.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden animate-slide-up stagger-4"
          style={{
            border: "1px solid var(--border-cream)",
            backgroundColor: "var(--ivory)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 sm:px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--border-cream)" }}
          >
            <ReceiptText size={16} style={{ color: "var(--olive-gray)" }} />
            <h2
              className="text-sm sm:text-base font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
            >
              รายละเอียดค่าธรรมเนียม
            </h2>
          </div>

          {/* Mobile: card list */}
          <ul className="sm:hidden divide-y" style={{ borderColor: "var(--border-cream)" }}>
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
                    style={{ color: "#b53333" }}
                  >
                    ฿{fmt(item.amount)}
                  </span>
                </div>
                <PercentBar value={item.percentage} />
              </li>
            ))}
          </ul>

          {/* Tablet/Desktop: table */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--warm-sand)" }}>
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
                    borderTop: "1px solid var(--border-cream)",
                    animationDelay: `${0.3 + i * 0.05}s`,
                  }}
                >
                  <td className="px-5 py-3" style={{ color: "var(--near-black)", overflowWrap: "anywhere" }}>
                    {item.name}
                  </td>
                  <td className="px-5 py-3 text-right" style={{ color: "#b53333" }}>
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
  label,
  value,
  sub,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 transition-transform hover:-translate-y-0.5"
      style={{
        backgroundColor: accent ? "var(--near-black)" : "var(--ivory)",
        border: `1px solid ${accent ? "var(--dark-surface)" : "var(--border-cream)"}`,
        boxShadow: accent
          ? "0 8px 28px rgba(0,0,0,0.12)"
          : "rgba(0,0,0,0.04) 0px 4px 20px",
      }}
    >
      <div
        className="mb-2.5"
        style={{ color: accent ? "var(--warm-silver)" : warn ? "#b53333" : "var(--olive-gray)" }}
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
          color: accent ? "var(--ivory)" : warn ? "#b53333" : "var(--near-black)",
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
        style={{ backgroundColor: "var(--warm-sand)" }}
      >
        <div
          className="h-full rounded-full animate-bar-grow"
          style={{ width: `${clamped}%`, backgroundColor: "var(--terracotta)" }}
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
