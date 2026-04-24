import type { AnalysisResult, HistoryEntry } from "../components/types";
import { PLATFORM_LABELS } from "./platform";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** CSV of a single analysis (summary rows + fee items). */
export function resultToCsv(
  result: AnalysisResult,
  opts: { costRate: number; profit: number; title?: string; createdAt?: number },
): string {
  const lines: string[] = [];
  lines.push(["ฟิลด์", "ค่า"].map(csvEscape).join(","));
  if (opts.title) lines.push(["ชื่อบิล", opts.title].map(csvEscape).join(","));
  if (opts.createdAt) lines.push(["วันที่", fmtDate(opts.createdAt)].map(csvEscape).join(","));
  if (result.platform)
    lines.push(["แพลตฟอร์ม", PLATFORM_LABELS[result.platform]].map(csvEscape).join(","));
  lines.push(["ราคาป้าย", result.labelPrice ?? result.grossSales].map(csvEscape).join(","));
  lines.push(["ยอดขายรวม", result.grossSales].map(csvEscape).join(","));
  lines.push(["ค่าธรรมเนียมรวม", result.totalFees].map(csvEscape).join(","));
  lines.push(["ยอดสุทธิ", result.netAmount].map(csvEscape).join(","));
  lines.push(["ต้นทุน %", opts.costRate].map(csvEscape).join(","));
  lines.push(["กำไร", opts.profit].map(csvEscape).join(","));
  lines.push("");
  lines.push(["รายการค่าธรรมเนียม", "จำนวน (฿)", "% ของยอดขาย"].map(csvEscape).join(","));
  for (const f of result.feeItems ?? []) {
    lines.push([f.name, f.amount, f.percentage.toFixed(2)].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function historyToCsv(entries: HistoryEntry[]): string {
  const header = [
    "วันที่",
    "ชื่อบิล",
    "แพลตฟอร์ม",
    "จำนวนรูป",
    "ราคาป้าย",
    "ยอดขายรวม",
    "ค่าธรรมเนียมรวม",
    "ยอดสุทธิ",
    "ต้นทุน %",
    "กำไร",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const e of entries) {
    lines.push(
      [
        fmtDate(e.createdAt),
        e.title,
        e.result.platform ? PLATFORM_LABELS[e.result.platform] : "—",
        e.imageCount,
        e.result.labelPrice ?? e.result.grossSales,
        e.result.grossSales,
        e.result.totalFees,
        e.result.netAmount,
        e.costRate,
        e.profit,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string | Blob, mime = "text/csv;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([`\uFEFF${content}`], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dynamically import html-to-image (browser-only) and export the node to PNG. */
export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor:
      getComputedStyle(document.documentElement).getPropertyValue("--parchment").trim() ||
      "#f5f4ed",
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function todayFilename(prefix: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}
