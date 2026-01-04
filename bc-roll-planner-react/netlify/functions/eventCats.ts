/**
 * Netlify Function: eventCats
 *
 * 用途
 * - 依照 seed / event / count 組出目標頁面 URL（預設抓 https://bc.godfat.org）
 * - 抓取 HTML 後，解析出「本次活動可抽到的貓（cats）」與其分組（groups）
 * - 以 JSON 回傳解析結果（含 event 資訊、來源判定、cats 清單等）
 *
 * 路徑（本機/部署後皆類似）
 * - /.netlify/functions/eventCats
 *
 * Query 參數
 * - seed: string（必填；種子）
 * - event: string（必填；活動代碼/值，通常可由 /.netlify/functions/events 取得）
 * - count: number（必填；正整數；影響來源頁面生成/顯示的抽卡格數）
 * - lang: string（預設 "tw"；會帶到抓取 URL 的 ?lang=）
 * - ui: string（預設 "tw"；會帶到抓取 URL 的 ?ui=）
 * - base_url: string（預設 "https://bc.godfat.org"；會去掉結尾的 /）
 *
 * （以下為「事件資訊」的附加欄位，會寫進回傳的 event，主要用於顯示）
 * - name: string（選填；預設等於 event）
 * - start_date: string（選填；預設 null）
 * - end_date: string（選填；預設 null）
 *
 * 範例請求
 * - /.netlify/functions/eventCats?seed=1234&event=2026-01-06_945&count=100&lang=tw&ui=tw
 *
 * 回應格式（200）
 * {
 *   event: { value, name, start_date, end_date },
 *   source: "find_select" | "last_select" | "none",
 *   count: number,    // cats.length
 *   groups: unknown,  // 實際結構由 parseEventCatsFromHtml 決定
 *   cats: unknown[]   // 實際結構由 parseEventCatsFromHtml 決定
 * }
 *
 * 錯誤
 * - 400: 缺少 seed/event 或 count 非正整數
 * - 500: 抓取或解析失敗（例如來源頁 HTML 結構改版）
 *
 * CORS / Preflight
 * - 支援 OPTIONS（回 204）
 * - 允許任意來源（Access-Control-Allow-Origin: "*")
 *
 * 快取
 * - 成功回應會給 60 秒快取（避免同參數一直重爬）
 */

import type { Handler } from "@netlify/functions";
import type { Event } from "../../shared/models";

import { fetchTextWithRetry } from "./_lib/http";
import { parseEventCatsFromHtml } from "./_lib/parseEventCats";

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

    const parsed = parseEventCatsFromHtml(html);

    const ev: Event = {
      value: eventValue,
      name: qs.name ? String(qs.name) : eventValue,
      start_date: qs.start_date ? String(qs.start_date) : null,
      end_date: qs.end_date ? String(qs.end_date) : null,
    };

    return json(
      200,
      {
        event: ev,
        source: parsed.source, // find_select / last_select / none
        count: parsed.cats.length,
        groups: parsed.groups,
        cats: parsed.cats,
      },
      60
    );
  } catch (e: any) {
    return json(500, {
      error: "eventCats function failed",
      details: String(e?.message || e),
    });
  }
};
