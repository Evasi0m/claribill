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
  History as HistoryIcon,
  Download,
  FileImage,
  Pencil,
  Store,
  Save,
  RefreshCw,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import HistoryModal from "./HistoryModal";
import type { AnalysisResult, FeeItem, HistoryEntry, Platform } from "./types";
import {
  loadPlatformRates,
  savePlatformRates,
  loadTheme,
  saveTheme,
  applyTheme,
  loadHistory,
  addHistory,
  updateHistory,
  removeHistory,
  clearHistory,
  newHistoryId,
  type Theme,
} from "../lib/storage";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  rateFor,
  DEFAULT_COST_RATE,
  type PlatformRates,
} from "../lib/platform";
import { computeProfit } from "../lib/profit";
import { applyBackup } from "../lib/backup";
import { makeThumbnail } from "../lib/thumbnail";
import {
  resultToCsv,
  downloadFile,
  exportNodeAsPng,
} from "../lib/export";
import { fmtMoney, fmtShortDate, todayFilename } from "../lib/format";

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
  "platform": <ชื่อแพลตฟอร์มที่ตรวจจับได้จากโลโก้/ชื่อ/สีของบิล: "shopee" | "lazada" | "tiktok" | "other" — หาไม่เจอให้ใส่ "other">,
  "labelPrice": <ยอดรวมสินค้าก่อนหักส่วนลด (ราคาป้ายเต็ม) เป็นตัวเลข — หาบรรทัดที่เขียนว่า "ยอดรวมสินค้าก่อนหักส่วนลด" หรือคำใกล้เคียง หากไม่มีให้ใช้ค่าเดียวกับ grossSales>,
  "grossSales": <ยอดขายหลังหักส่วนลดจากผู้ขาย (ยอดที่ลูกค้าจ่ายจริงก่อนหักค่าธรรมเนียม) เป็นตัวเลข>,
  "totalFees": <ยอดรวมค่าธรรมเนียมทั้งหมด เป็นตัวเลข บวกเสมอ (ไม่ติดลบ)>,
  "netAmount": <ยอดเงินสุทธิที่ผู้ขายได้รับหลังหักค่าธรรมเนียม เป็นตัวเลข>,
  "feeItems": [
    { "name": <ชื่อรายการ>, "amount": <จำนวนเงิน เป็นตัวเลข บวกเสมอ>, "percentage": <เปอร์เซ็นต์เมื่อเทียบกับ grossSales เป็นตัวเลข> }
  ]
}`;

type UploadedImage = {
  id: string;
  preview: string;
  base64: string;
  mimeType: string;
};

function aggregate(results: AnalysisResult[]): AnalysisResult {
  const sum = (
    key: keyof Pick<AnalysisResult, "labelPrice" | "grossSales" | "totalFees" | "netAmount">,
  ) => results.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const labelPrice = sum("labelPrice") || sum("grossSales");
  const grossSales = sum("grossSales");
  const totalFees = sum("totalFees");
  const netAmount = sum("netAmount");

  // Detect dominant platform (most common non-`other` wins; fallback `other`)
  const counts = new Map<Platform, number>();
  for (const r of results) {
    const p = (r.platform ?? "other") as Platform;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let platform: Platform = "other";
  let best = -1;
  for (const [p, c] of counts) {
    if (p !== "other" && c > best) {
      platform = p;
      best = c;
    }
  }
  if (best < 0 && counts.size > 0) platform = "other";

  // Merge fee items by name; re-compute percentage off the combined grossSales
  const map = new Map<string, FeeItem>();
  for (const r of results) {
    for (const f of r.feeItems ?? []) {
      const key = f.name.trim();
      const prev = map.get(key);
      if (prev) prev.amount += Number(f.amount) || 0;
      else
        map.set(key, {
          name: key,
          amount: Number(f.amount) || 0,
          percentage: 0,
        });
    }
  }
  const feeItems = Array.from(map.values()).map((f) => ({
    ...f,
    percentage: grossSales > 0 ? (f.amount / grossSales) * 100 : 0,
  }));

  return { labelPrice, grossSales, totalFees, netAmount, feeItems, platform };
}

function recomputePercentages(r: AnalysisResult): AnalysisResult {
  return {
    ...r,
    feeItems: r.feeItems.map((f) => ({
      ...f,
      percentage: r.grossSales > 0 ? (f.amount / r.grossSales) * 100 : 0,
    })),
  };
}

export default function Dashboard({ apiKey, onClearKey }: Props) {
  const [dragging, setDragging] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(AI_MODELS[0]);
  // Dashboard is loaded via dynamic({ ssr: false }) so localStorage is safe at init
  const [platformRates, setPlatformRates] = useState<PlatformRates>(loadPlatformRates);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportNodeRef = useRef<HTMLDivElement>(null);

  // Apply theme to <html> element — side effect only, no state update
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handlePlatformRatesChange = (r: PlatformRates) => {
    setPlatformRates(r);
    savePlatformRates(r);
    // Re-derive cost/profit live when user tweaks — result view reads from state directly
    if (result && currentEntryId) {
      const costRate = rateFor(r, result.platform);
      const { profit } = computeProfit(result, costRate);
      const next = updateHistory(currentEntryId, { costRate, profit });
      setHistory(next);
    }
  };

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    saveTheme(t);
    applyTheme(t);
  };

  const handleRestore = (bundle: unknown) => {
    const next = applyBackup(bundle);
    setHistory(next.history);
    setPlatformRates(next.platformRates);
    setTheme(next.theme);
    applyTheme(next.theme);
    // Clear the active result if its entry no longer exists in the
    // restored history — otherwise the seller would see ghost numbers
    // that can't be edited.
    if (currentEntryId && !next.history.find((h) => h.id === currentEntryId)) {
      setCurrentEntryId(null);
      setResult(null);
    }
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
    setCurrentEntryId(null);
    setError(null);
  }, []);

  // Paste from clipboard (Ctrl/Cmd+V) — grabs image(s) anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Don't intercept when user is typing in an editable field
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    setResult(null);
    setCurrentEntryId(null);
  };

  const clearAllImages = () => {
    setImages([]);
    setResult(null);
    setCurrentEntryId(null);
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
      e.target.value = "";
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  const persistHistory = async (
    res: AnalysisResult,
    imageCount: number,
    sources: UploadedImage[],
  ) => {
    const costRate = rateFor(platformRates, res.platform);
    const { profit } = computeProfit(res, costRate);
    const datePart = fmtShortDate(Date.now());
    const platformLabel = res.platform ? PLATFORM_LABELS[res.platform] : "บิล";
    // Thumbnail generation is best-effort — if any one source fails (oversize
    // EXIF, unsupported codec on the device) we just drop that thumbnail
    // rather than blocking the history save.
    const thumbnails = (
      await Promise.all(
        sources.map((s) =>
          makeThumbnail(s.preview).catch(() => null),
        ),
      )
    ).filter((t): t is string => t !== null);
    const entry: HistoryEntry = {
      id: newHistoryId(),
      createdAt: Date.now(),
      title: `${platformLabel} • ${datePart}`,
      result: res,
      costRate,
      profit,
      imageCount,
      thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
    };
    const next = addHistory(entry);
    setHistory(next);
    setCurrentEntryId(entry.id);
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentEntryId(null);
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
          if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid"))
            throw err;
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
      const agg = aggregate(all);
      setResult(agg);
      await persistHistory(agg, images.length, images);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
        setError("API Key ไม่ถูกต้อง กรุณาตรวจสอบและอัปเดตใน Settings");
        // Auto-open Settings so the seller can fix the key without an
        // extra step. They've already hit a hard wall — don't make them
        // hunt for the gear icon.
        setShowSettings(true);
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

  const fmt = fmtMoney;

  /* ------------- edit handlers ------------- */

  const updateResult = (patch: Partial<AnalysisResult>) => {
    setResult((prev) => {
      if (!prev) return prev;
      const merged = recomputePercentages({ ...prev, ...patch });
      if (currentEntryId) {
        const costRate = rateFor(platformRates, merged.platform);
        const { profit } = computeProfit(merged, costRate);
        const next = updateHistory(currentEntryId, {
          result: merged,
          costRate,
          profit,
        });
        setHistory(next);
      }
      return merged;
    });
  };

  const updateFeeItem = (index: number, patch: Partial<FeeItem>) => {
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.feeItems.map((f, i) => (i === index ? { ...f, ...patch } : f));
      // Recompute totalFees from items to keep things coherent
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const merged = recomputePercentages({ ...prev, feeItems: items, totalFees });
      if (currentEntryId) {
        const costRate = rateFor(platformRates, merged.platform);
        const { profit } = computeProfit(merged, costRate);
        const next = updateHistory(currentEntryId, {
          result: merged,
          costRate,
          profit,
        });
        setHistory(next);
      }
      return merged;
    });
  };

  const addFeeItem = () => {
    setResult((prev) => {
      if (!prev) return prev;
      const items: FeeItem[] = [
        ...prev.feeItems,
        { name: "ค่าธรรมเนียมเพิ่มเติม", amount: 0, percentage: 0, userAdded: true },
      ];
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const merged = recomputePercentages({ ...prev, feeItems: items, totalFees });
      if (currentEntryId) {
        const costRate = rateFor(platformRates, merged.platform);
        const { profit } = computeProfit(merged, costRate);
        const next = updateHistory(currentEntryId, {
          result: merged,
          costRate,
          profit,
        });
        setHistory(next);
      }
      return merged;
    });
  };

  const removeFeeItem = (index: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const target = prev.feeItems[index];
      // Only remove items the seller added themselves — AI-extracted rows
      // stay locked so totalFees can't be silently understated.
      if (!target?.userAdded) return prev;
      const items = prev.feeItems.filter((_, i) => i !== index);
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const merged = recomputePercentages({ ...prev, feeItems: items, totalFees });
      if (currentEntryId) {
        const costRate = rateFor(platformRates, merged.platform);
        const { profit } = computeProfit(merged, costRate);
        const next = updateHistory(currentEntryId, {
          result: merged,
          costRate,
          profit,
        });
        setHistory(next);
      }
      return merged;
    });
  };

  const changePlatform = (p: Platform) => updateResult({ platform: p });

  /* ------------- history handlers ------------- */

  const openHistoryEntry = (entry: HistoryEntry) => {
    setResult(entry.result);
    setCurrentEntryId(entry.id);
    setImages([]);
    setError(null);
    setShowHistory(false);
  };

  const deleteHistoryEntry = (id: string) => {
    const next = removeHistory(id);
    setHistory(next);
    if (currentEntryId === id) {
      setCurrentEntryId(null);
    }
  };

  const renameHistoryEntry = (id: string, title: string) => {
    const next = updateHistory(id, { title });
    setHistory(next);
  };

  const clearAllHistory = () => {
    clearHistory();
    setHistory([]);
    setCurrentEntryId(null);
  };

  /* ------------- export handlers ------------- */

  const costRate = result ? rateFor(platformRates, result.platform) : DEFAULT_COST_RATE;
  const breakdown = result
    ? computeProfit(result, costRate)
    : { basis: 0, cost: 0, profit: 0, marginPct: 0 };
  const labelPrice = breakdown.basis;
  const cost = breakdown.cost;
  const profit = breakdown.profit;

  const exportCsv = () => {
    if (!result) return;
    const entry = history.find((h) => h.id === currentEntryId);
    const csv = resultToCsv(result, {
      costRate,
      profit,
      title: entry?.title,
      createdAt: entry?.createdAt,
    });
    downloadFile(todayFilename("claribill", "csv"), csv);
  };

  const exportPng = async () => {
    if (!exportNodeRef.current) return;
    try {
      await exportNodeAsPng(exportNodeRef.current, todayFilename("claribill", "png"));
    } catch (e) {
      setError(`บันทึกรูปไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

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
        className="sticky top-0 z-20 px-4 py-3"
        style={{
          backgroundColor: "color-mix(in oklab, var(--parchment) 92%, transparent)",
          backdropFilter: "blur(12px) saturate(1.4)",
          WebkitBackdropFilter: "blur(12px) saturate(1.4)",
          borderBottom: "1px solid var(--border-warm)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <h1
            className="text-lg sm:text-xl font-medium shrink-0 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="control-icon glass-primary" style={{ width: 32, height: 32 }}>
              <Sparkles size={14} />
            </span>
            Claribill
          </h1>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="control-sm glass-chip truncate max-w-[110px] sm:max-w-[200px]"
              style={{ color: "var(--text-tertiary)" }}
              title={activeModel}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: loading ? "var(--terracotta)" : "var(--success)" }}
              />
              <span className="truncate">{activeModel}</span>
            </span>
            <button
              onClick={() => setShowHistory(true)}
              aria-label="History"
              className="control-icon glass-chip relative"
              style={{ color: "var(--charcoal-warm)" }}
            >
              <HistoryIcon size={16} />
              {history.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-[9px] font-medium rounded-full flex items-center justify-center"
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    backgroundColor: "var(--terracotta)",
                    color: "var(--ivory)",
                  }}
                >
                  {history.length > 99 ? "99+" : history.length}
                </span>
              )}
            </button>
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
        {error && (
          <ErrorPanel
            message={error}
            canRetry={images.length > 0 && !loading}
            onRetry={handleAnalyze}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {/* Results */}
        {result && (
          <div ref={exportNodeRef}>
            <AnalysisDisplay
              result={result}
              fmt={fmt}
              costRate={costRate}
              labelPrice={labelPrice}
              cost={cost}
              profit={profit}
              onUpdateResult={updateResult}
              onUpdateFeeItem={updateFeeItem}
              onAddFeeItem={addFeeItem}
              onRemoveFeeItem={removeFeeItem}
              onChangePlatform={changePlatform}
              onExportCsv={exportCsv}
              onExportPng={exportPng}
              saved={!!currentEntryId}
            />
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onClearKey={onClearKey}
          apiKey={apiKey}
          platformRates={platformRates}
          onPlatformRatesChange={handlePlatformRatesChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          onRestore={handleRestore}
        />
      )}

      {showHistory && (
        <HistoryModal
          entries={history}
          onClose={() => setShowHistory(false)}
          onOpen={openHistoryEntry}
          onDelete={deleteHistoryEntry}
          onEditTitle={renameHistoryEntry}
          onClearAll={clearAllHistory}
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

            <button
              onClick={onPick}
              className="aspect-square flex flex-col items-center justify-center gap-1.5 press-shrink transition-all hover:scale-[1.02]"
              style={{
                borderRadius: "calc(var(--radius) - 4px)",
                border: "2px dashed color-mix(in oklab, var(--border-warm) 80%, transparent)",
                backgroundColor: "color-mix(in oklab, var(--ivory) 40%, transparent)",
                color: "var(--text-secondary)",
              }}
              aria-label="เพิ่มรูป"
            >
              <Plus size={20} style={{ color: "var(--terracotta)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--charcoal-warm)" }}>
                เพิ่มรูป
              </span>
            </button>
          </div>

          <div
            className="flex items-center justify-between gap-2 px-1"
            style={{ color: "var(--text-tertiary)" }}
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
              style={{ color: dragging ? "var(--terracotta)" : "var(--text-secondary)" }}
            />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm" style={{ color: "var(--charcoal-warm)" }}>
              {dragging ? "วางได้เลย!" : "แตะเพื่อเลือก หรือลากรูปมาวาง"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              รองรับหลายรูป • JPG, PNG, WEBP • วาง Ctrl+V ก็ได้
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
          <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
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

function ErrorPanel({
  message,
  canRetry,
  onRetry,
  onOpenSettings,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 200;
  const isApiKeyError =
    message.includes("API Key ไม่ถูกต้อง") ||
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid");

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
              color: "var(--danger-deep)",
              maxHeight: expanded || !isLong ? "1200px" : "4.5rem",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            {message}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {isApiKeyError ? (
              <button
                onClick={onOpenSettings}
                className="control-sm"
                style={{
                  backgroundColor: "var(--danger)",
                  color: "var(--ivory)",
                  border: "1px solid var(--danger)",
                }}
              >
                <Settings size={12} />
                เปิด Settings
              </button>
            ) : (
              canRetry && (
                <button
                  onClick={onRetry}
                  className="control-sm"
                  style={{
                    backgroundColor: "var(--danger)",
                    color: "var(--ivory)",
                    border: "1px solid var(--danger)",
                  }}
                >
                  <RefreshCw size={12} />
                  ลองอีกครั้ง
                </button>
              )
            )}
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
   Analysis display — bento grid + fee table (with edit + export toolbar)
   ========================================================================== */

function AnalysisDisplay({
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

/* ==========================================================================
   Platform picker
   ========================================================================== */

function PlatformPicker({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Platform[] = ["shopee", "lazada", "tiktok", "other"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="control-sm glass-chip"
        style={{ color: "var(--charcoal-warm)" }}
      >
        <Store size={12} style={{ color: PLATFORM_COLORS[value] }} />
        {PLATFORM_LABELS[value]}
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 z-30 glass-strong p-1 animate-slide-down"
            style={{ minWidth: 150 }}
          >
            {options.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 hover:opacity-80"
                style={{
                  color: p === value ? "var(--terracotta)" : "var(--text-primary)",
                  backgroundColor:
                    p === value
                      ? "color-mix(in oklab, var(--terracotta) 12%, transparent)"
                      : "transparent",
                  borderRadius: "calc(var(--radius) - 8px)",
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: PLATFORM_COLORS[p],
                  }}
                />
                {PLATFORM_LABELS[p]}
                {p === value && <Check size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   Editable numeric value
   ========================================================================== */

function EditableNumber({
  value,
  valuePrefix = "",
  valueAbs = false,
  valueColor,
  className,
  style,
  onCommit,
  fmt,
  readOnly,
}: {
  value: number;
  valuePrefix?: string;
  valueAbs?: boolean;
  valueColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onCommit?: (n: number) => void;
  fmt: (n: number) => string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync draft from parent when not actively editing
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) {
      onCommit?.(n);
    }
    setEditing(false);
  };

  if (readOnly || !onCommit) {
    return (
      <span className={className} style={{ color: valueColor, ...style }}>
        {valuePrefix}
        {fmt(valueAbs ? Math.abs(value) : value)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={className}
        style={{
          ...style,
          color: valueColor ?? "var(--text-primary)",
          background: "color-mix(in oklab, var(--warm-sand) 30%, transparent)",
          border: "1px solid var(--terracotta)",
          borderRadius: 8,
          padding: "2px 8px",
          outline: "none",
          width: "100%",
          fontVariantNumeric: "tabular-nums",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${className ?? ""} text-left group relative inline-flex items-center gap-1`}
      style={{
        color: valueColor,
        cursor: "text",
        ...style,
      }}
      title="คลิกเพื่อแก้ไข"
    >
      <span>
        {valuePrefix}
        {fmt(valueAbs ? Math.abs(value) : value)}
      </span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
        style={{ color: "var(--text-tertiary)" }}
      />
    </button>
  );
}

/* ==========================================================================
   Cards
   ========================================================================== */

function HeroCard({
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

function BigCard({
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
  const fmt = fmtMoney;
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
          fmt={fmt}
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

function SmallCard({
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
  const fmt = fmtMoney;
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
            fmt={fmt}
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

/* ==========================================================================
   Label-price prompt — surfaces an input for Shopee/Lazada bills, where the
   slip only shows the post-discount price. Without the original tag price,
   the cost basis (labelPrice × (1 − costRate%)) is computed off the wrong
   number and the resulting profit understates margin.
   ========================================================================== */

function LabelPriceNotice({
  platform,
  labelPrice,
  grossSales,
  fmt,
  onCommit,
}: {
  platform: Platform;
  labelPrice: number;
  grossSales: number;
  fmt: (n: number) => string;
  onCommit: (n: number) => void;
}) {
  const needsTagPrice = platform === "shopee" || platform === "lazada";
  const isUnset = labelPrice <= grossSales;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // Sync draft from parent when not actively editing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(labelPrice > grossSales ? String(labelPrice) : "");
  }, [labelPrice, grossSales, editing]);

  if (!needsTagPrice) return null;

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onCommit(n);
    setEditing(false);
  };

  return (
    <div className="card animate-slide-up p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className="control-icon shrink-0"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "color-mix(in oklab, var(--info) 15%, transparent)",
            color: "var(--info)",
          }}
        >
          <Tag size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {isUnset ? "ใส่ราคาป้ายสินค้า" : "ราคาป้ายสินค้า"}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--charcoal-warm)", overflowWrap: "anywhere" }}
          >
            บิล {PLATFORM_LABELS[platform]} ไม่แสดงราคาป้ายเต็ม — ใส่ราคาป้ายเพื่อคำนวณต้นทุนได้ถูกต้อง
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className="text-sm tabular-nums shrink-0"
              style={{ color: "var(--charcoal-warm)" }}
            >
              ฿
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={draft}
              onFocus={() => setEditing(true)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setDraft(labelPrice > grossSales ? String(labelPrice) : "");
                  setEditing(false);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder={`มากกว่า ${fmt(grossSales)}`}
              className="input-glass tabular-nums"
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Profit breakdown
   ========================================================================== */

function ProfitBreakdown({
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

/* ==========================================================================
   Fee Table
   ========================================================================== */

function FeeTable({
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
  // Sort desc by amount but keep original index for editing
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

/* ==========================================================================
   Editable text (fee item name)
   ========================================================================== */

function EditableText({
  value,
  onCommit,
  className,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync draft from parent when not actively editing
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
    if (v) onCommit(v);
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
        className={className}
        style={{
          ...style,
          background: "color-mix(in oklab, var(--warm-sand) 30%, transparent)",
          border: "1px solid var(--terracotta)",
          borderRadius: 8,
          padding: "2px 8px",
          outline: "none",
          width: "100%",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${className ?? ""} text-left group inline-flex items-center gap-1`}
      style={{ cursor: "text", ...style }}
      title="คลิกเพื่อแก้ไข"
    >
      <span>{value}</span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
        style={{ color: "var(--text-tertiary)" }}
      />
    </button>
  );
}
