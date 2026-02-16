// src/shared/config/bcEnv.ts

type BcEnv = {
  ui: string;
  lang: string;
  pastEventLimit: number;
  baseUrl: string;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string") {
    throw new Error(`[bcEnv] Missing or non-string env: ${name}`);
  }
  const s = v.trim();
  if (!s) throw new Error(`[bcEnv] Empty env value: ${name}`);
  return s;
}

function mustPosInt(v: unknown, name: string): number {
  if (typeof v !== "string") {
    throw new Error(`[bcEnv] Missing env: ${name}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`[bcEnv] Invalid positive number env: ${name}, got: ${v}`);
  }
  return Math.floor(n);
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// 重點：用「靜態欄位」讀 VITE_*（不要用 import.meta.env[key]）
const E = import.meta.env;

export const BC_ENV: BcEnv = {
  ui: mustString(E.VITE_BC_UI, "VITE_BC_UI"),
  lang: mustString(E.VITE_BC_LANG, "VITE_BC_LANG"),
  pastEventLimit: mustPosInt(
    E.VITE_BC_PAST_EVENT_LIMIT,
    "VITE_BC_PAST_EVENT_LIMIT"
  ),
  baseUrl: normalizeBaseUrl(
    mustString(E.VITE_BC_GODFAT_BASE_URL, "VITE_BC_GODFAT_BASE_URL")
  ),
};

// // DEBUG
// if (E.DEV) {
//   // eslint-disable-next-line no-console
//   console.log("[BC_ENV]", {
//     VITE_BC_UI: E.VITE_BC_UI,
//     VITE_BC_LANG: E.VITE_BC_LANG,
//     VITE_BC_PAST_EVENT_LIMIT: E.VITE_BC_PAST_EVENT_LIMIT,
//     VITE_BC_GODFAT_BASE_URL: E.VITE_BC_GODFAT_BASE_URL,
//     parsed: BC_ENV,
//   });
// }
