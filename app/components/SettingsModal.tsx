"use client";

import { X, Trash2, RefreshCw, KeyRound } from "lucide-react";

interface Props {
  onClose: () => void;
  onClearKey: () => void;
}

export default function SettingsModal({ onClose, onClearKey }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{
        backgroundColor: "rgba(20,20,19,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-sm p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div
              className="control-icon glass-primary"
              style={{ width: 32, height: 32 }}
            >
              <KeyRound size={14} />
            </div>
            <h2
              className="text-lg font-medium"
              style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
            >
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="control-icon glass-chip"
            style={{ color: "var(--stone-gray)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* API Key section */}
        <div className="glass-chip p-4 mb-4">
          <p className="text-xs font-medium mb-1.5" style={{ color: "var(--charcoal-warm)" }}>
            API Key ปัจจุบัน
          </p>
          <p
            className="text-xs font-mono tracking-wider"
            style={{ color: "var(--stone-gray)" }}
          >
            ••••••••••••••••••••••••••••••••
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onClearKey}
            className="control glass-danger-solid w-full"
          >
            <Trash2 size={14} />
            ลบ API Key และออกจากระบบ
          </button>
          <button
            onClick={onClose}
            className="control glass-chip w-full"
            style={{ color: "var(--charcoal-warm)" }}
          >
            <RefreshCw size={14} />
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
