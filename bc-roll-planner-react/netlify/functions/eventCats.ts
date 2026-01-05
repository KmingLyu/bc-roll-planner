/**
 * Netlify Function: eventCats
 *
 * 用途
 * - 依照 event / lang / ui 組出目標頁面 URL（預設抓 https://bc.godfat.org）
 * - 抓取 HTML 後，解析出「本次活動可抽到的貓（cats）」與其分組（groups）
 * - 注意：只解析 last_select（find_select 需要 seed/count 才會出現）
 *
 * 路徑
 * - /.netlify/functions/eventCats
 *
 * Query 參數
 * - event: string（必填；活動代碼/值）
 * - lang: string（預設 "tw"）
 * - ui: string（預設 "tw"）
 * - base_url: string（預設 "https://bc.godfat.org"；會去掉結尾的 /）
 *
 * （以下為「事件資訊」的附加欄位，會寫進回傳的 event，主要用於顯示）
 * - name: string（選填；預設等於 event）
 * - start_date: string（選填；預設 null）
 * - end_date: string（選填；預設 null）
 *
 * 範例
 * - /.netlify/functions/eventCats?event=2026-01-06_991&lang=tw&ui=tw
 *
 * 回應格式（200）
 * {
 *   event: { value, name, start_date, end_date },
 *   source: "last_select" | "none",
 *   count: number,
 *   groups: TierGroup[],
 *   cats: Cat[]
 * }
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

export const handler: Handler = async (evt) => {
  if (evt.httpMethod === "OPTIONS") {
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
    const qs = evt.queryStringParameters || {};
    const eventValue = (qs.event || "").trim();
    const lang = (qs.lang || "tw").trim();
    const ui = (qs.ui || "tw").trim();
    const baseUrl = (qs.base_url || "https://bc.godfat.org").replace(
      /\/+$/,
      ""
    );

    if (!eventValue) return json(400, { error: "缺少 event" });

    // 只需要帶 event/lang/ui（不帶 seed/count）
    const url =
      `${baseUrl}/?event=${encodeURIComponent(eventValue)}` +
      `&lang=${encodeURIComponent(lang)}` +
      `&ui=${encodeURIComponent(ui)}`;

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
        source: parsed.source, // last_select / none
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
