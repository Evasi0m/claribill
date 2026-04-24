"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Upload,
  Settings,
  X,
  TrendingDown,
  TrendingUp,
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
  Plus,
  Tag,
  Package,
  Layers,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import type { AnalysisResult, FeeItem } from "./types";

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

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mimeType: string;
};

function aggregate(results: AnalysisResult[]): AnalysisResult {
  const sum = (key: keyof Pick<AnalysisResult, "labelPrice" | "grossSales" | "totalFees" | "netAmount">) =>
    results.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const labelPrice = sum("labelPrice") || sum("grossSales");
  const grossSales = sum("grossSales");
  const totalFees = sum("totalFees");
  const netAmount = sum("netAmount");

  // Merge fee items by name; re-compute percentage off the combined grossSales.
  const map = new Map<string, FeeItem>();
  for (const r of results) {
    for (const f of r.feeItems ?? []) {
      const key = f.name.trim();
      const prev = map.get(key);
      if (prev) prev.amount += Number(f.amount) || 0;
      else map.set(key, { name: key, amount: Number(f.amount) || 0, percentage: 0 });
    }
  }
  const feeItems = Array.from(map.values()).map((f) => ({
    ...f,
    percentage: grossSales > 0 ? (f.amount / grossSales) * 100 : 0,
  }));

  return { labelPrice, grossSales, totalFees, netAmount, feeItems };
}

export default function Dashboard({ apiKey, onClearKey }: Props) {
  const [dragging, setDragging] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const invalid = Array.from(files).length - valid.length;
    if (invalid > 0 && valid.length === 0) {
      setError("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setImages((prev) => [...prev, { id, preview: dataUrl, base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    setResult(null);
    setError(null);
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    setResult(null);
  };

  const clearAllImages = () => {
    setImages([]);
    setResult(null);
    setError(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // reset so selecting same file again still triggers change
      e.target.value = "";
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: images.length });

    const genAI = new GoogleGenerativeAI(apiKey);

    const analyzeOne = async (img: UploadedImage): Promise<AnalysisResult> => {
      const imagePart = {
        inlineData: { data: img.base64, mimeType: img.mimeType },
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
          return JSON.parse(jsonMatch[0]) as AnalysisResult;
        } catch (err: unknown) {
          lastError = err;
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) throw err;
          if (!isRetryableError(msg)) throw err;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("วิเคราะห์ไม่สำเร็จ");
    };

    try {
      const all: AnalysisResult[] = [];
      for (let i = 0; i < images.length; i++) {
        setProgress({ current: i + 1, total: images.length });
        const r = await analyzeOne(images[i]);
        all.push(r);
      }
      setResult(aggregate(all));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
        setError("API Key ไม่ถูกต้อง กรุณาตรวจสอบและอัปเดตใน Settings");
      } else if (isRetryableError(msg)) {
        setError(
          `ลองทุกโมเดลแล้วไม่สำเร็จ (${AI_MODELS.join(", ")}) — โควต้าหมดหรือโมเดลไม่พร้อมใช้งาน กรุณารอสักครู่ เปลี่ยน API key หรือเปิด billing ใน Google AI Studio\n\nรายละเอียด: ${msg}`,
        );
      } else {
        setError(`วิเคราะห์ไม่สำเร็จ: ${msg}`);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--parchment)" }}>
      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
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
      <nav
        className="sticky top-0 z-20 px-4 py-3 glass"
        style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <h1
            className="text-lg sm:text-xl font-medium shrink-0 flex items-center gap-2"
            style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
          >
            <span className="control-icon glass-primary" style={{ width: 32, height: 32 }}>
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
        <UploadZone
          images={images}
          dragging={dragging}
          setDragging={setDragging}
          onDrop={handleDrop}
          onPick={openPicker}
          onRemove={removeImage}
          onClearAll={clearAllImages}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
        />

        {/* Analyze Button */}
        {images.length > 0 && !loading && (
          <button
            onClick={handleAnalyze}
            className="control glass-primary w-full animate-slide-up animate-glow-pulse"
            style={{ height: 52 }}
          >
            <Upload size={16} />
            วิเคราะห์{images.length > 1 ? `ทั้งหมด ${images.length} รูป` : "สลิป"}
          </button>
        )}

        {/* Loading */}
        {loading && <LoadingPanel modelName={activeModel} progress={progress} />}

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

/* ==========================================================================
   Upload Zone — multi-image
   ========================================================================== */

function UploadZone({
  images,
  dragging,
  setDragging,
  onDrop,
  onPick,
  onRemove,
  onClearAll,
  fileInputRef,
  onFileChange,
}: {
  images: UploadedImage[];
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const hasImages = images.length > 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="glass transition-all duration-300 animate-slide-up overflow-hidden"
      style={{
        minHeight: hasImages ? undefined : 200,
        borderStyle: "dashed",
        borderColor: dragging
          ? "var(--terracotta)"
          : "color-mix(in oklab, var(--border-warm) 80%, transparent)",
        borderWidth: 2,
        transform: dragging ? "scale(1.005)" : "scale(1)",
        boxShadow: dragging
          ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 12px 40px rgba(201,100,66,0.2)"
          : undefined,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      {hasImages ? (
        <div className="p-3 sm:p-4 space-y-3 animate-fade-in">
          {/* Thumbnail grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden animate-scale-in group"
                style={{
                  borderRadius: "calc(var(--radius) - 4px)",
                  backgroundColor: "var(--warm-sand)",
                  border: "1px solid color-mix(in oklab, var(--border-warm) 80%, transparent)",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={`สลิป ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: "rgba(20,20,19,0.7)",
                    color: "var(--ivory)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  #{i + 1}
                </div>
                <button
                  onClick={() => onRemove(img.id)}
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center press-shrink transition-transform hover:scale-110"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: "rgba(20,20,19,0.75)",
                    color: "var(--ivory)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Add more */}
            <button
              onClick={onPick}
              className="aspect-square flex flex-col items-center justify-center gap-1.5 press-shrink transition-all hover:scale-[1.02]"
              style={{
                borderRadius: "calc(var(--radius) - 4px)",
                border: "2px dashed color-mix(in oklab, var(--border-warm) 80%, transparent)",
                backgroundColor: "color-mix(in oklab, var(--ivory) 40%, transparent)",
                color: "var(--olive-gray)",
              }}
              aria-label="เพิ่มรูป"
            >
              <Plus size={20} style={{ color: "var(--terracotta)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--charcoal-warm)" }}>
                เพิ่มรูป
              </span>
            </button>
          </div>

          {/* Status row */}
          <div
            className="flex items-center justify-between gap-2 px-1"
            style={{ color: "var(--stone-gray)" }}
          >
            <span className="text-xs flex items-center gap-1.5">
              <Layers size={12} />
              {images.length} รูป — ระบบจะวิเคราะห์และรวมยอดให้อัตโนมัติ
            </span>
            <button
              onClick={onClearAll}
              className="text-xs underline underline-offset-2 press-shrink hover:opacity-70"
              style={{ color: "var(--danger)" }}
            >
              ล้างทั้งหมด
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="w-full flex flex-col items-center justify-center gap-3 py-10 sm:py-14 px-4 cursor-pointer press-shrink"
        >
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
              รองรับหลายรูป • JPG, PNG, WEBP
            </p>
          </div>
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
   Loading / Error panels
   ========================================================================== */

function LoadingPanel({
  modelName,
  progress,
}: {
  modelName: string;
  progress: { current: number; total: number } | null;
}) {
  const pct = progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  return (
    <div className="glass shimmer-overlay p-4 animate-scale-in">
      <div className="flex items-center gap-3">
        <div className="control-icon glass-primary shrink-0" style={{ width: 40, height: 40 }}>
          <Loader2 size={18} className="animate-spin-slow" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: "var(--charcoal-warm)" }}>
            {progress && progress.total > 1
              ? `กำลังวิเคราะห์ ${progress.current}/${progress.total}`
              : "กำลังวิเคราะห์..."}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--stone-gray)" }}>
            {modelName}
          </p>
        </div>
      </div>
      {progress && progress.total > 1 && (
        <div
          className="mt-3 h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "color-mix(in oklab, var(--warm-sand) 80%, transparent)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--terracotta-2), var(--terracotta))",
            }}
          />
        </div>
      )}
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
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="glass-danger overflow-hidden animate-slide-down">
      <div className="flex items-start gap-3 p-4">
        <div
          className="control-icon shrink-0 animate-bounce-in"
          style={{ backgroundColor: "rgba(181,51,51,0.15)", color: "var(--danger)" }}
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

/* ==========================================================================
   Analysis display — bento grid + fee table
   ========================================================================== */

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
  const labelPrice = result.labelPrice ?? result.grossSales;
  const cost = labelPrice * (1 - costRate / 100);
  const profit = result.netAmount - cost;
  const marginPct = labelPrice > 0 ? (profit / labelPrice) * 100 : 0;
  const profitPositive = profit >= 0;
  const profitColor = profitPositive ? "var(--success)" : "var(--danger)";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Bento grid */}
      <div
        className="grid gap-3 sm:gap-4"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        }}
      >
        {/* Big — ยอดขายรวม (col-span 4 on mobile, 2 on desktop) */}
        <div className="col-span-4 sm:col-span-2 animate-slide-up stagger-1">
          <BigCard
            icon={<BarChart3 size={18} />}
            iconBg="color-mix(in oklab, var(--info) 18%, transparent)"
            iconColor="var(--info)"
            label="ยอดขายรวม"
            value={`฿${fmt(result.grossSales)}`}
            sub={
              result.labelPrice && result.labelPrice !== result.grossSales
                ? `ราคาป้าย ฿${fmt(result.labelPrice)}`
                : undefined
            }
          />
        </div>

        {/* Big — กำไร */}
        <div className="col-span-4 sm:col-span-2 animate-slide-up stagger-2">
          <BigCard
            icon={<TrendingUp size={18} />}
            iconBg={
              profitPositive
                ? "color-mix(in oklab, var(--success) 15%, transparent)"
                : "color-mix(in oklab, var(--danger) 15%, transparent)"
            }
            iconColor={profitColor}
            label="กำไรโดยประมาณ"
            value={`${profitPositive ? "฿" : "−฿"}${fmt(Math.abs(profit))}`}
            valueColor={profitColor}
            sub={`${marginPct.toFixed(2)}% • ต้นทุน −${costRate}% = ฿${fmt(cost)}`}
          />
        </div>

        {/* Small — ค่าธรรมเนียม */}
        <div className="col-span-2 animate-slide-up stagger-3">
          <SmallCard
            icon={<TrendingDown size={16} />}
            iconBg="color-mix(in oklab, var(--danger) 15%, transparent)"
            iconColor="var(--danger)"
            label="ค่าธรรมเนียม"
            value={`฿${fmt(result.totalFees)}`}
            valueColor="var(--danger)"
            sub={`${feeRate.toFixed(2)}% ของยอดขาย`}
          />
        </div>

        {/* Small — ยอดสุทธิ (accent) */}
        <div className="col-span-2 animate-slide-up stagger-4">
          <SmallCard
            icon={<Wallet size={16} />}
            iconBg="rgba(255,255,255,0.1)"
            iconColor="var(--terracotta-2)"
            label="ยอดสุทธิ"
            value={`฿${fmt(result.netAmount)}`}
            accent
          />
        </div>
      </div>

      {/* Profit breakdown rows */}
      <ProfitBreakdown
        labelPrice={labelPrice}
        cost={cost}
        netAmount={result.netAmount}
        costRate={costRate}
        fmt={fmt}
      />

      {/* Fee Table */}
      {result.feeItems && result.feeItems.length > 0 && (
        <FeeTable items={result.feeItems} grossSales={result.grossSales} fmt={fmt} />
      )}
    </div>
  );
}

/* ==========================================================================
   Cards
   ========================================================================== */

function BigCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div className="glass p-5 sm:p-6 h-full transition-transform hover:-translate-y-0.5">
      <div
        className="control-icon mb-3"
        style={{ width: 40, height: 40, backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <p className="text-xs mb-1.5" style={{ color: "var(--stone-gray)" }}>
        {label}
      </p>
      <p
        className="text-2xl sm:text-3xl font-medium break-words leading-tight"
        style={{
          fontFamily: "Georgia, serif",
          color: valueColor ?? "var(--near-black)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-2" style={{ color: "var(--stone-gray)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function SmallCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`${accent ? "glass-accent" : "glass"} p-4 h-full transition-transform hover:-translate-y-0.5`}
    >
      <div
        className="control-icon mb-2"
        style={{
          width: 32,
          height: 32,
          backgroundColor: accent ? "rgba(255,255,255,0.08)" : iconBg,
          color: accent ? "var(--terracotta-2)" : iconColor,
        }}
      >
        {icon}
      </div>
      <p
        className="text-[11px] mb-1"
        style={{ color: accent ? "var(--warm-silver)" : "var(--stone-gray)" }}
      >
        {label}
      </p>
      <p
        className="text-base sm:text-lg font-medium break-words leading-tight"
        style={{
          fontFamily: "Georgia, serif",
          color: accent ? "var(--ivory)" : valueColor ?? "var(--near-black)",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="text-[11px] mt-1"
          style={{ color: accent ? "var(--warm-silver)" : "var(--stone-gray)" }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
   Profit breakdown (compact)
   ========================================================================== */

function ProfitBreakdown({
  labelPrice,
  cost,
  netAmount,
  costRate,
  fmt,
}: {
  labelPrice: number;
  cost: number;
  netAmount: number;
  costRate: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="glass overflow-hidden animate-slide-up">
      <div
        className="flex items-center gap-2 px-4 sm:px-5 py-3"
        style={{ borderBottom: "1px solid color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
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
          style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
        >
          ที่มาของกำไร
        </h2>
      </div>
      <ul
        className="divide-y"
        style={{ borderColor: "color-mix(in oklab, var(--border-cream) 80%, transparent)" }}
      >
        <BreakdownRow
          icon={<Tag size={12} />}
          iconColor="var(--info)"
          iconBg="color-mix(in oklab, var(--info) 15%, transparent)"
          label="ราคาป้าย"
          value={`฿${fmt(labelPrice)}`}
        />
        <BreakdownRow
          icon={<Package size={12} />}
          iconColor="var(--charcoal-warm)"
          iconBg="color-mix(in oklab, var(--warm-sand) 80%, transparent)"
          label={`ต้นทุน (−${costRate}%)`}
          value={`−฿${fmt(cost)}`}
        />
        <BreakdownRow
          icon={<Wallet size={12} />}
          iconColor="var(--terracotta)"
          iconBg="color-mix(in oklab, var(--terracotta) 12%, transparent)"
          label="ยอดสุทธิรับเข้า"
          value={`฿${fmt(netAmount)}`}
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
  value: string;
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
      <span className="text-sm font-medium shrink-0" style={{ color: "var(--near-black)" }}>
        {value}
      </span>
    </li>
  );
}

/* ==========================================================================
   Fee Table — readable, with zebra stripes, sorted, with totals
   ========================================================================== */

function FeeTable({
  items,
  grossSales,
  fmt,
}: {
  items: FeeItem[];
  grossSales: number;
  fmt: (n: number) => string;
}) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, i) => s + i.amount, 0);
  const maxAmount = Math.max(...sorted.map((i) => i.amount), 1);

  return (
    <div className="glass overflow-hidden animate-slide-up">
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
            backgroundColor: "color-mix(in oklab, var(--danger) 12%, transparent)",
            color: "var(--danger)",
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
        <span
          className="ml-auto text-[11px] px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "color-mix(in oklab, var(--warm-sand) 70%, transparent)",
            color: "var(--stone-gray)",
            border: "1px solid color-mix(in oklab, var(--border-warm) 80%, transparent)",
          }}
        >
          {sorted.length} รายการ
        </span>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center px-4 sm:px-5 py-2 text-[11px] uppercase tracking-wide font-medium"
        style={{
          gridTemplateColumns: "1fr auto 90px",
          gap: "12px",
          color: "var(--stone-gray)",
          backgroundColor: "color-mix(in oklab, var(--warm-sand) 35%, transparent)",
        }}
      >
        <span>รายการ</span>
        <span className="text-right">จำนวน</span>
        <span className="text-right">%</span>
      </div>

      {/* Rows */}
      <ul>
        {sorted.map((item, i) => {
          const barPct = (item.amount / maxAmount) * 100;
          const salesPct =
            item.percentage ||
            (grossSales > 0 ? (item.amount / grossSales) * 100 : 0);
          return (
            <li
              key={`${item.name}-${i}`}
              className="relative animate-fade-in"
              style={{
                animationDelay: `${0.2 + i * 0.04}s`,
                backgroundColor:
                  i % 2 === 0 ? "transparent" : "color-mix(in oklab, var(--warm-sand) 18%, transparent)",
                borderTop:
                  i === 0
                    ? undefined
                    : "1px solid color-mix(in oklab, var(--border-cream) 70%, transparent)",
              }}
            >
              {/* Background magnitude bar */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 animate-bar-grow"
                style={{
                  width: `${barPct}%`,
                  background:
                    "linear-gradient(90deg, color-mix(in oklab, var(--danger) 10%, transparent), color-mix(in oklab, var(--danger) 3%, transparent))",
                  pointerEvents: "none",
                }}
              />
              <div
                className="relative grid items-center px-4 sm:px-5 py-3"
                style={{ gridTemplateColumns: "1fr auto 90px", gap: "12px" }}
              >
                <span
                  className="text-sm min-w-0"
                  style={{
                    color: "var(--near-black)",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {item.name}
                </span>
                <span
                  className="text-sm font-medium whitespace-nowrap text-right tabular-nums"
                  style={{ color: "var(--danger)" }}
                >
                  ฿{fmt(item.amount)}
                </span>
                <span
                  className="text-xs text-right tabular-nums"
                  style={{ color: "var(--olive-gray)" }}
                >
                  {salesPct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Total row */}
      <div
        className="grid items-center px-4 sm:px-5 py-3"
        style={{
          gridTemplateColumns: "1fr auto 90px",
          gap: "12px",
          borderTop: "1px solid color-mix(in oklab, var(--border-cream) 80%, transparent)",
          backgroundColor: "color-mix(in oklab, var(--warm-sand) 45%, transparent)",
        }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--charcoal-warm)" }}>
          รวม
        </span>
        <span
          className="text-sm font-medium whitespace-nowrap text-right tabular-nums"
          style={{ color: "var(--danger)" }}
        >
          ฿{fmt(total)}
        </span>
        <span
          className="text-xs text-right tabular-nums"
          style={{ color: "var(--olive-gray)" }}
        >
          {grossSales > 0 ? ((total / grossSales) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
  );
}
