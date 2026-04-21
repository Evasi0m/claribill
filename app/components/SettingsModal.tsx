"use client";

import { X, Trash2, RefreshCw } from "lucide-react";

interface Props {
  onClose: () => void;
  onClearKey: () => void;
}

export default function SettingsModal({ onClose, onClearKey }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(20,20,19,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          backgroundColor: "var(--ivory)",
          border: "1px solid var(--border-cream)",
          boxShadow: "rgba(0,0,0,0.15) 0px 8px 40px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-lg font-medium"
            style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--stone-gray)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* API Key section */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            backgroundColor: "var(--warm-sand)",
            border: "1px solid var(--border-warm)",
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: "var(--charcoal-warm)" }}>
            API Key ปัจจุบัน
          </p>
          <p className="text-xs font-mono" style={{ color: "var(--stone-gray)" }}>
            ••••••••••••••••••••••••••••••••
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onClearKey}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#b53333", color: "#faf9f5" }}
          >
            <Trash2 size={14} />
            ลบ API Key และออกจากระบบ
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--warm-sand)",
              color: "var(--charcoal-warm)",
              boxShadow: "0px 0px 0px 1px var(--border-warm)",
            }}
          >
            <RefreshCw size={14} />
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
