// src/app/theme/tokens.ts
/**
 * 全站配色與樣式 token（單一來源）。
 * 若要調整整體視覺風格，優先改這裡。
 */
export const APP_THEME_TOKENS = {
  palette: {
    primary: "#2563eb",
    secondary: "#334155",
    success: "#15803d",
    warning: "#c2410c",
    error: "#b91c1c",
    info: "#1d4ed8",
    backgroundDefault: "#f4f7fb",
    backgroundPaper: "#ffffff",
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    divider: "rgba(148, 163, 184, 0.36)",
  },

  surface: {
    bodyTop: "#f6f8fc",
    bodyBottom: "#f2f5fa",
    paperBorder: "#d8e1ec",
    paperShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
    tableHead: "#edf2f8",
    tableRowBorder: "#e5ebf3",
    scrollbarThumb: "#b7c4d9",
  },

  input: {
    background: "#ffffff",
    border: "#c8d4e3",
    borderHover: "#94a3b8",
    focusRing: "rgba(37, 99, 235, 0.16)",
  },

  chip: {
    background: "#f8fafc",
    border: "#cbd5e1",
  },

  planner: {
    status: {
      hitBg: "rgba(253, 224, 71, 0.32)",
      hitNode: "rgba(253, 224, 71, 0.95)",
      guaranteedBg: "rgba(217, 70, 239, 0.16)",
      guaranteedNode: "rgba(217, 70, 239, 0.82)",
    },
    target: {
      border: "rgba(16, 185, 129, 0.95)",
      borderSoft: "rgba(16, 185, 129, 0.8)",
      background: "rgba(16, 185, 129, 0.1)",
      nodeBg: "rgba(16, 185, 129, 0.92)",
      nodeText: "rgba(0, 0, 0, 0.85)",
      ring: "0 0 0 2px rgba(16, 185, 129, 0.3), 0 8px 16px rgba(16, 185, 129, 0.18)",
    },
    eventHues: [
      240, 24, 180, 288, 0, 216, 324, 48, 204, 336, 12, 252, 276, 36, 228, 312,
      192, 348, 264, 96, 108, 120, 132, 144, 156, 168, 72, 84, 60, 300,
    ],
  },
} as const;
