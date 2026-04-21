"use client";

import { useState } from "react";
import { KeyRound, ExternalLink, ArrowRight } from "lucide-react";

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
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--parchment)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          backgroundColor: "var(--ivory)",
          border: "1px solid var(--border-cream)",
          boxShadow: "rgba(0,0,0,0.05) 0px 4px 24px",
        }}
      >
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ backgroundColor: "var(--terracotta)" }}
          >
            <KeyRound size={22} color="#faf9f5" />
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="apikey"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--charcoal-warm)" }}
            >
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
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                backgroundColor: "var(--parchment)",
                border: "1px solid var(--border-warm)",
                color: "var(--near-black)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3898ec";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,152,236,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-warm)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {error && (
              <p className="mt-1.5 text-xs" style={{ color: "#b53333" }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--terracotta)",
              color: "var(--ivory)",
            }}
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
          className="mt-5 rounded-xl p-3 text-xs leading-relaxed"
          style={{
            backgroundColor: "var(--warm-sand)",
            color: "var(--olive-gray)",
          }}
        >
          🔒 API Key ของคุณถูกเก็บไว้ใน Browser เท่านั้น ไม่มีการส่งข้อมูลไปยัง Server ใดๆ
        </div>
      </div>
    </div>
  );
}
