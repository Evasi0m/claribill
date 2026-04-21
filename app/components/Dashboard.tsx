"use client";

import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import type { AnalysisResult } from "./types";

interface Props {
  apiKey: string;
  onClearKey: () => void;
}

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

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

      const imagePart = {
        inlineData: {
          data: imageData.base64,
          mimeType: imageData.mimeType,
        },
      };

      const response = await model.generateContent([PROMPT, imagePart]);
      const text = response.response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("ไม่พบข้อมูล JSON ในผลลัพธ์");

      const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);
      setResult(parsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key")) {
        setError("API Key ไม่ถูกต้อง กรุณาตรวจสอบและอัปเดตใน Settings");
      } else {
        setError(`วิเคราะห์ไม่สำเร็จ: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--parchment)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
        style={{
          backgroundColor: "var(--ivory)",
          borderBottom: "1px solid var(--border-cream)",
        }}
      >
        <h1
          className="text-xl font-medium"
          style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
        >
          Claribill
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80"
          style={{
            backgroundColor: "var(--warm-sand)",
            color: "var(--charcoal-warm)",
            boxShadow: "0px 0px 0px 1px var(--border-warm)",
          }}
        >
          <Settings size={14} />
          Settings
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative rounded-2xl cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? "var(--terracotta)" : "var(--border-warm)"}`,
            backgroundColor: dragging ? "rgba(201,100,66,0.04)" : "var(--ivory)",
            minHeight: "200px",
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
            <div className="relative p-4">
              <img
                src={imagePreview}
                alt="สลิปที่อัปโหลด"
                className="max-h-72 mx-auto rounded-xl object-contain"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                  setImageData(null);
                  setResult(null);
                  setError(null);
                }}
                className="absolute top-6 right-6 p-1 rounded-full"
                style={{ backgroundColor: "var(--dark-surface)", color: "var(--warm-silver)" }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <div
                className="p-4 rounded-2xl"
                style={{ backgroundColor: "var(--warm-sand)" }}
              >
                <ImageIcon size={28} style={{ color: "var(--olive-gray)" }} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm" style={{ color: "var(--charcoal-warm)" }}>
                  วางรูปสลิปที่นี่ หรือคลิกเพื่อเลือกไฟล์
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--terracotta)", color: "var(--ivory)" }}
          >
            <Upload size={16} />
            วิเคราะห์สลิป
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--terracotta)" }} />
            <span className="text-sm" style={{ color: "var(--olive-gray)" }}>
              กำลังวิเคราะห์ด้วย Gemini AI...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl text-sm"
            style={{
              backgroundColor: "rgba(181,51,51,0.08)",
              border: "1px solid rgba(181,51,51,0.2)",
              color: "#b53333",
            }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && <AnalysisDisplay result={result} fmt={fmt} />}
      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onClearKey={onClearKey} />
      )}
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<BarChart3 size={18} />}
          label="ยอดขายรวม"
          value={`฿${fmt(result.grossSales)}`}
          accent={false}
        />
        <SummaryCard
          icon={<TrendingDown size={18} />}
          label="ค่าธรรมเนียมรวม"
          value={`฿${fmt(result.totalFees)}`}
          sub={`${feeRate.toFixed(2)}% ของยอดขาย`}
          accent={false}
          warn
        />
        <SummaryCard
          icon={<Wallet size={18} />}
          label="ยอดสุทธิ"
          value={`฿${fmt(result.netAmount)}`}
          accent
        />
      </div>

      {/* Fee Breakdown Table */}
      {result.feeItems && result.feeItems.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--border-cream)",
            backgroundColor: "var(--ivory)",
          }}
        >
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: "1px solid var(--border-cream)" }}
          >
            <ReceiptText size={16} style={{ color: "var(--olive-gray)" }} />
            <h2
              className="text-base font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
            >
              รายละเอียดค่าธรรมเนียม
            </h2>
          </div>
          <table className="w-full text-sm">
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
                  style={{ borderTop: "1px solid var(--border-cream)" }}
                >
                  <td className="px-5 py-3" style={{ color: "var(--near-black)" }}>
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
      className="rounded-2xl p-5"
      style={{
        backgroundColor: accent ? "var(--near-black)" : "var(--ivory)",
        border: `1px solid ${accent ? "var(--dark-surface)" : "var(--border-cream)"}`,
        boxShadow: "rgba(0,0,0,0.05) 0px 4px 24px",
      }}
    >
      <div
        className="mb-3"
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
        className="text-xl font-medium"
        style={{
          fontFamily: "Georgia, serif",
          color: accent ? "var(--ivory)" : warn ? "#b53333" : "var(--near-black)",
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
    <div className="flex items-center justify-end gap-2">
      <div
        className="w-16 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--warm-sand)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: "var(--terracotta)" }}
        />
      </div>
      <span style={{ color: "var(--olive-gray)", minWidth: "3rem", textAlign: "right" }}>
        {value.toFixed(2)}%
      </span>
    </div>
  );
}
