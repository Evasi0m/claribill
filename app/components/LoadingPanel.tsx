"use client";

import { Loader2 } from "lucide-react";

/** Streamed analysis progress — single text line if there's only one image,
 *  current/total counter + progress bar for batches. */
export function LoadingPanel({
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
