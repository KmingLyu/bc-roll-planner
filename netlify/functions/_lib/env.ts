// netlify/functions/_lib/env.ts

export type BcServerEnv = {
  ui: string;
  lang: string;
  baseUrl: string;
};

function readString(keys: string[], fallback: string): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// 後端只需要讀取 ui、lang、baseUrl，不需要pastEventLimit
export function getBcServerEnv(): BcServerEnv {
  const ui = readString(["BC_UI", "VITE_BC_UI"], "tw");
  const lang = readString(["BC_LANG", "VITE_BC_LANG"], "tw");
  const baseUrl = normalizeBaseUrl(
    readString(
      ["BC_GODFAT_BASE_URL", "VITE_BC_GODFAT_BASE_URL"],
      "https://bc.godfat.org"
    )
  );

  return { ui, lang, baseUrl };
}
