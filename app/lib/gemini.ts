/** Lightweight API-key sanity check.
 *
 *  Calls the public models.list endpoint, which doesn't burn analysis quota
 *  and returns 400 INVALID_ARGUMENT for revoked/wrong keys, 403 for keys
 *  that lack the Generative Language API, and 429 when the project is rate-
 *  limited. Anything else (network failure, CORS, etc.) we surface as a
 *  generic error so the seller can decide whether to retry. */
export type ValidateResult =
  | { ok: true }
  | { ok: false; message: string };

export async function validateApiKey(key: string): Promise<ValidateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    key,
  )}&pageSize=1`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) return { ok: true };
    const errBody = (await res.json().catch(() => null)) as
      | { error?: { status?: string; message?: string } }
      | null;
    const status = errBody?.error?.status ?? "";
    const detail = errBody?.error?.message ?? `HTTP ${res.status}`;
    if (
      status === "INVALID_ARGUMENT" ||
      detail.includes("API key not valid") ||
      detail.includes("API_KEY_INVALID")
    ) {
      return { ok: false, message: "API Key ไม่ถูกต้อง — โปรดตรวจสอบและลองใหม่" };
    }
    if (status === "PERMISSION_DENIED" || res.status === 403) {
      return {
        ok: false,
        message:
          "Key นี้ไม่มีสิทธิ์ใช้ Generative Language API — โปรดเปิดใช้งานใน Google AI Studio",
      };
    }
    if (res.status === 429 || status === "RESOURCE_EXHAUSTED") {
      return {
        ok: false,
        message: "โควต้าหมด — รอสักครู่แล้วลองใหม่ หรือเปลี่ยน Key",
      };
    }
    return { ok: false, message: `ตรวจสอบ Key ไม่ผ่าน: ${detail}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `เชื่อมต่อ Gemini ไม่ได้: ${msg}` };
  }
}
