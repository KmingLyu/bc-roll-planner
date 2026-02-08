// src/shared/config/dataSources.ts
/**
 * 集中管理資料來源（爬蟲 / 參考網站）
 * - UI 開始頁面會直接顯示這裡的網址
 * - 未來要換來源，只改這一個檔案即可
 */
export const DATA_SOURCES = {
  crawler: {
    // name: "bc.godfat（抽卡軌道/卡池資料來源）",
    name: "",
    url: "https://bc.godfat.org",
  },
} as const;

export type DataSourceKey = keyof typeof DATA_SOURCES;
