import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult, UploadedImage } from "../components/types";
import { aggregate } from "./aggregate";

const AI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

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

/** AnalyzeError discriminates the recoverable shapes the UI cares about so
 *  the caller can route to the right CTA (Settings vs retry vs raw error). */
export type AnalyzeError =
  | { kind: "apiKey"; message: string }
  | { kind: "retryable"; message: string }
  | { kind: "other"; message: string };

export interface UseAnalyzeReturn {
  loading: boolean;
  progress: { current: number; total: number } | null;
  activeModel: string;
  /** Run the multi-image analysis pipeline. Resolves with the aggregated
   *  result on success, rejects with an AnalyzeError on failure. The hook
   *  also exposes loading/progress state for the UI to render. */
  analyze: (images: UploadedImage[]) => Promise<AnalysisResult>;
}

export function useAnalyze(apiKey: string): UseAnalyzeReturn {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeModel, setActiveModel] = useState<string>(AI_MODELS[0]);

  const analyze = async (images: UploadedImage[]): Promise<AnalysisResult> => {
    if (images.length === 0) {
      throw classifyError(new Error("ไม่มีรูปภาพ"));
    }
    setLoading(true);
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
      return aggregate(all);
    } catch (err) {
      throw classifyError(err);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return { loading, progress, activeModel, analyze };
}

function classifyError(err: unknown): AnalyzeError {
  const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return { kind: "apiKey", message: "API Key ไม่ถูกต้อง กรุณาตรวจสอบและอัปเดตใน Settings" };
  }
  if (isRetryableError(msg)) {
    return {
      kind: "retryable",
      message: `ลองทุกโมเดลแล้วไม่สำเร็จ (${AI_MODELS.join(", ")}) — โควต้าหมดหรือโมเดลไม่พร้อมใช้งาน กรุณารอสักครู่ เปลี่ยน API key หรือเปิด billing ใน Google AI Studio\n\nรายละเอียด: ${msg}`,
    };
  }
  return { kind: "other", message: `วิเคราะห์ไม่สำเร็จ: ${msg}` };
}
