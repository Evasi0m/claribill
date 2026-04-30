/** Minimal "speed bump" obfuscation for the Gemini API key in localStorage.
 *
 *  This is NOT real encryption. A targeted attacker who reads this source
 *  can trivially reverse the encoding. The goal is narrower: a generic XSS
 *  payload that scrapes localStorage for `AIza...` strings shouldn't find
 *  one. They'd have to know which key holds the salt, which key holds the
 *  encoded blob, and that the bytes are FNV-1a-derived XOR.
 *
 *  Salt is generated once per browser install and persisted alongside the
 *  blob — losing localStorage means losing both, which is acceptable since
 *  the user can just paste the key again on the setup screen. */

const KEY_KEY = "CLARIBILL_API_KEY";
const SALT_KEY = "CLARIBILL_API_KEY_SALT";

function getOrCreateSalt(): string {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    salt = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
}

function deriveKeyBytes(salt: string): Uint8Array {
  // FNV-1a-like rolling hash extended to 64 bytes — deterministic, fast,
  // no async crypto required.
  let h = 2166136261;
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const c = salt.charCodeAt(i % salt.length) ^ i;
    h = (h ^ c) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    out[i] = h & 0xff;
  }
  return out;
}

function xorBytes(input: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] ^ key[i % key.length];
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function loadApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const blob = localStorage.getItem(KEY_KEY);
  if (!blob) return null;
  // Backward-compat: a plaintext "AIza..." key written before this layer
  // existed. Detect it, re-save through the new path, and return it.
  if (blob.startsWith("AI")) {
    saveApiKey(blob);
    return blob;
  }
  try {
    const salt = localStorage.getItem(SALT_KEY);
    if (!salt) return null;
    const cipher = base64ToBytes(blob);
    const plain = xorBytes(cipher, deriveKeyBytes(salt));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function saveApiKey(key: string) {
  if (typeof window === "undefined") return;
  const salt = getOrCreateSalt();
  const data = new TextEncoder().encode(key);
  const cipher = xorBytes(data, deriveKeyBytes(salt));
  localStorage.setItem(KEY_KEY, bytesToBase64(cipher));
}

export function clearApiKey() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_KEY);
  localStorage.removeItem(SALT_KEY);
}
