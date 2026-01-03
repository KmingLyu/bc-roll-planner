/**
 * Netlify Function: trackGraph
 *
 * 用途
 * - 依照 seed / event / count 組出目標頁面 URL（預設抓 https://bc.godfat.org）
 * - 抓取 HTML 後，找出「軌道表格（tracks table）」並解析每個格子
 * - 把解析後的 cells 建成可用的「抽卡軌道圖（graph）」並以 JSON 回傳
 *
 * 路徑（本機/部署後皆類似）
 * - /.netlify/functions/trackGraph
 *
 * Query 參數
 * - seed: string（必填；種子）
 * - event: string（必填；活動代碼/值，通常可由 /.netlify/functions/events 取得）
 * - count: number（必填；正整數，要生成/解析的格子數量）
 * - lang: string（預設 "tw"；會帶到抓取 URL 的 ?lang=）
 * - ui: string（預設 "tw"；會帶到抓取 URL 的 ?ui=）
 * - base_url: string（預設 "https://bc.godfat.org"；會去掉結尾的 /）
 *
 * （以下為「事件資訊」的附加欄位，會寫進回傳的 graph.event，主要用於顯示）
 * - name: string（選填；預設等於 event）
 * - start_date: string（選填；預設 null）
 * - end_date: string（選填；預設 null）
 *
 * 範例請求
 * - /.netlify/functions/trackGraph?seed=1234&event=2026-01-06_945&count=100&lang=tw&ui=tw
 *
 * 回應格式（200）
 * {
 *   graph: unknown   // 實際結構由 buildTrackGraphFromCells 決定
 * }
 *
 * 錯誤
 * - 400: 缺少 seed/event 或 count 非正整數
 * - 500: 抓取或解析失敗（例如找不到 tracks table，代表來源頁 HTML 結構可能改版）
 *
 * CORS / Preflight
 * - 支援 OPTIONS（回 204）
 * - 允許任意來源（Access-Control-Allow-Origin: "*")
 *
 * 快取
 * - 成功回應會給 60 秒快取（避免同參數一直重爬）
 */

import type { Handler } from "@netlify/functions";
import { fetchTextWithRetry } from "./_lib/http";
import {
  findTracksTable,
  parseTrackCellsFromTableHtml,
} from "./_lib/parseTrackTable";
import { buildTrackGraphFromCells } from "./_lib/buildGraph";
// import type { Event } from "./_lib/buildGraph";
// import type { Event } from "@shared/models";
import type { Event } from "../../shared/models";

function json(statusCode: number, body: unknown, cacheSeconds = 0) {
  const cache =
    cacheSeconds > 0
      ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
      : "no-store";

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Cache-Control": cache,
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: "",
    };
  }

  try {
    const qs = event.queryStringParameters || {};
    const seed = (qs.seed || "").trim();
    const eventValue = (qs.event || "").trim();
    const count = Number(qs.count || "");
    const lang = (qs.lang || "tw").trim();
    const ui = (qs.ui || "tw").trim();
    const baseUrl = (qs.base_url || "https://bc.godfat.org").replace(
      /\/+$/,
      ""
    );

    if (!seed) return json(400, { error: "缺少 seed" });
    if (!eventValue) return json(400, { error: "缺少 event" });
    if (!Number.isFinite(count) || count <= 0)
      return json(400, { error: "count 必須是正整數" });

    const url =
      `${baseUrl}/?lang=${encodeURIComponent(lang)}` +
      `&ui=${encodeURIComponent(ui)}` +
      `&seed=${encodeURIComponent(seed)}` +
      `&count=${encodeURIComponent(String(count))}` +
      `&event=${encodeURIComponent(eventValue)}`;

    const html = await fetchTextWithRetry(url, {
      timeoutMs: 30_000,
      retries: 3,
    });

    const { tableHtml } = findTracksTable(html);
    if (!tableHtml) {
      return json(500, { error: "找不到 tracks table（HTML 結構可能改版）" });
    }

    const raw_cells = parseTrackCellsFromTableHtml(tableHtml);

    const ev: Event = {
      value: eventValue,
      name: qs.name ? String(qs.name) : eventValue,
      start_date: qs.start_date ? String(qs.start_date) : null,
      end_date: qs.end_date ? String(qs.end_date) : null,
    };

    const graph = buildTrackGraphFromCells({
      seed,
      count,
      event: ev,
      raw_cells,
    });

    // 這裡給一點短快取（同參數重打不會每次都爬）
    return json(200, { graph }, 60);
  } catch (e: any) {
    return json(500, {
      error: "trackGraph function failed",
      details: String(e?.message || e),
    });
  }
};
