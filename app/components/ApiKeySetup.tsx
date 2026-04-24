"use client";

import { useState } from "react";
import { KeyRound, ExternalLink, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

interface Props {
  onSave: (key: string) => void;
}

export default function ApiKeySetup({ onSave }: Props) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("กรุณากรอก API Key ก่อนดำเนินการต่อ");
      return;
    }
    if (!trimmed.startsWith("AI")) {
      setError("API Key ของ Google Gemini มักขึ้นต้นด้วย 'AI' — กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    onSave(trimmed);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ backgroundColor: "var(--parchment)" }}
    >
      {/* Ambient background orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-20 w-80 h-80 rounded-full opacity-50 animate-pulse-soft"
          style={{ background: "radial-gradient(circle, rgba(201,100,66,0.3), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 -right-20 w-96 h-96 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(217,119,87,0.25), transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(232,230,220,0.8), transparent 70%)" }}
        />
      </div>

      <div className="glass-strong w-full max-w-md p-7 sm:p-8 animate-scale-in relative">
        {/* Logo / Title */}
        <div className="mb-7 text-center">
          <div
            className="glass-primary inline-flex items-center justify-center mb-4 animate-glow-pulse"
            style={{ width: 56, height: 56, borderRadius: "var(--radius)" }}
          >
            <Sparkles size={24} />
          </div>
          <h1
            className="text-3xl font-medium leading-tight"
            style={{ fontFamily: "Georgia, serif", color: "var(--near-black)" }}
          >
            Claribill
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--olive-gray)" }}>
            วิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซจากสลิปของคุณ
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="apikey"
              className="text-sm font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--charcoal-warm)" }}
            >
              <KeyRound size={13} style={{ color: "var(--terracotta)" }} />
              Google Gemini API Key
            </label>
            <input
              id="apikey"
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError("");
              }}
              placeholder="AIza..."
              className="input-glass"
              autoComplete="off"
            />
            {error && (
              <p
                className="mt-1.5 text-xs animate-slide-down"
                style={{ color: "var(--danger)" }}
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="control glass-primary w-full"
            style={{ height: 52 }}
          >
            Save &amp; Start
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Help link */}
        <p className="mt-5 text-center text-xs" style={{ color: "var(--stone-gray)" }}>
          ยังไม่มี API Key?{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-2"
            style={{ color: "var(--terracotta)" }}
          >
            ขอฟรีได้ที่นี่
            <ExternalLink size={11} />
          </a>
        </p>

        {/* Security note */}
        <div
          className="glass-chip mt-5 p-3 text-xs leading-relaxed flex items-start gap-2"
          style={{ color: "var(--olive-gray)" }}
        >
          <ShieldCheck
            size={14}
            className="shrink-0 mt-0.5"
            style={{ color: "var(--success)" }}
          />
          <span>
            API Key ของคุณถูกเก็บไว้ใน Browser เท่านั้น ไม่มีการส่งข้อมูลไปยัง Server ใดๆ
          </span>
        </div>
      </div>
    </div>
  );
}
