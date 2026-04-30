"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Upload,
  Settings,
  Sparkles,
  History as HistoryIcon,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import HistoryModal from "./HistoryModal";
import { UploadZone } from "./UploadZone";
import { LoadingPanel } from "./LoadingPanel";
import { ErrorPanel } from "./ErrorPanel";
import { AnalysisDisplay } from "./result/AnalysisDisplay";
import type {
  AnalysisResult,
  FeeItem,
  HistoryEntry,
  Platform,
  UploadedImage,
} from "./types";
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
  rateFor,
  DEFAULT_COST_RATE,
  type PlatformRates,
} from "../lib/platform";
import { aggregate, recomputePercentages } from "../lib/aggregate";
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
              fmt={fmtMoney}
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
