"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import { recomputePercentages } from "../lib/aggregate";
import { computeProfit, syncResultToHistory } from "../lib/profit";
import { applyBackup } from "../lib/backup";
import { makeThumbnail } from "../lib/thumbnail";
import { useAnalyze } from "../lib/useAnalyze";
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

export default function Dashboard({ apiKey, onClearKey }: Props) {
  const [dragging, setDragging] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Dashboard is loaded via dynamic({ ssr: false }) so localStorage is safe at init
  const [platformRates, setPlatformRates] = useState<PlatformRates>(loadPlatformRates);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportNodeRef = useRef<HTMLDivElement>(null);
  const { loading, progress, activeModel, analyze } = useAnalyze(apiKey);

  // Apply theme to <html> element — side effect only, no state update
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handlePlatformRatesChange = (r: PlatformRates) => {
    setPlatformRates(r);
    savePlatformRates(r);
    // Re-derive cost/profit live when user tweaks — result view reads from
    // state directly so we only need to push the new numbers into history.
    if (result) {
      const updatedHistory = syncResultToHistory(result, currentEntryId, r);
      if (updatedHistory) setHistory(updatedHistory);
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
    setError(null);
    setResult(null);
    setCurrentEntryId(null);
    try {
      const agg = await analyze(images);
      setResult(agg);
      await persistHistory(agg, images.length, images);
    } catch (err) {
      // useAnalyze throws AnalyzeError-shaped objects. We only need the
      // message + kind to decide which CTA to show.
      const e = err as { kind?: string; message?: string };
      setError(e.message ?? String(err));
      if (e.kind === "apiKey") {
        // Auto-open Settings so the seller can fix the key without an
        // extra step. They've already hit a hard wall — don't make them
        // hunt for the gear icon.
        setShowSettings(true);
      }
    }
  };

  /* ------------- edit handlers ------------- */

  /** Apply a derivation function to the active result, recompute fee
   *  percentages, and persist the change to the matching history entry.
   *  Returning null from the derive callback aborts the mutation (used by
   *  removeFeeItem to refuse deleting AI-extracted rows). */
  const mutateResult = (
    derive: (prev: AnalysisResult) => AnalysisResult | null,
  ) => {
    setResult((prev) => {
      if (!prev) return prev;
      const next = derive(prev);
      if (next === null) return prev;
      const merged = recomputePercentages(next);
      const updatedHistory = syncResultToHistory(merged, currentEntryId, platformRates);
      if (updatedHistory) setHistory(updatedHistory);
      return merged;
    });
  };

  const updateResult = (patch: Partial<AnalysisResult>) =>
    mutateResult((prev) => ({ ...prev, ...patch }));

  const updateFeeItem = (index: number, patch: Partial<FeeItem>) =>
    mutateResult((prev) => {
      const items = prev.feeItems.map((f, i) => (i === index ? { ...f, ...patch } : f));
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      return { ...prev, feeItems: items, totalFees };
    });

  const addFeeItem = () =>
    mutateResult((prev) => {
      const items: FeeItem[] = [
        ...prev.feeItems,
        { name: "ค่าธรรมเนียมเพิ่มเติม", amount: 0, percentage: 0, userAdded: true },
      ];
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      return { ...prev, feeItems: items, totalFees };
    });

  const removeFeeItem = (index: number) =>
    mutateResult((prev) => {
      const target = prev.feeItems[index];
      // Only remove items the seller added themselves — AI-extracted rows
      // stay locked so totalFees can't be silently understated.
      if (!target?.userAdded) return null;
      const items = prev.feeItems.filter((_, i) => i !== index);
      const totalFees = items.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      return { ...prev, feeItems: items, totalFees };
    });

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
