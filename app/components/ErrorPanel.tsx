"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  RefreshCw,
  Settings,
} from "lucide-react";

/** Surfaces analysis errors with appropriate recovery CTAs. API key errors
 *  jump to Settings; everything else gets a retry button when images are
 *  still in state. The raw message can always be copied for support. */
export function ErrorPanel({
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
