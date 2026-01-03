/**
 * events.ts
 *
 * 用途
 * - 從指定的 base_url（預設 https://bc.godfat.org）抓取首頁 HTML
 * - 解析並回傳活動清單（upcoming / past）
 *
 * 路徑（本機/部署後皆類似）
 * - /.netlify/functions/events
 *
 * Query 參數
 * - type: "upcoming" | "past"（預設 "upcoming"）
 * - limit: number（預設 10；非數字時回退 10）
 * - lang: string（預設 "tw"；會帶到 base_url 的 ?lang=）
 * - ui: string（預設 "tw"；會帶到 base_url 的 ?ui=）
 * - base_url: string（預設 "https://bc.godfat.org"；會去掉結尾的 /）
 *
 * 範例請求
 * - /.netlify/functions/events?type=upcoming&limit=5&lang=tw&ui=tw
 * - /.netlify/functions/events?type=past&limit=3&lang=tw&ui=tw
 *
 * 回應格式（200）
 * {
 *   type: "upcoming" | "past",
 *   count: number,
 *   events: unknown[]   // 由 parseEventsFromHomeHtml 決定結構
 * }
 *
 * 錯誤
 * - 400: type 非 upcoming/past
 * - 500: 抓取或解析失敗
 *
 * CORS / Preflight
 * - 支援 OPTIONS（回 204）
 * - 允許任意來源（Access-Control-Allow-Origin: "*")
 *
 * 快取
 * - Cache-Control: no-store（避免快取）
 */

import type { Handler } from "@netlify/functions";
import { fetchTextWithRetry } from "./_lib/http";
import { parseEventsFromHomeHtml } from "./_lib/parseEvents";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Cache-Control": "no-store",
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
    const type = (qs.type || "upcoming").toLowerCase() as "upcoming" | "past";
    const limit = Number(qs.limit || "10");
    const lang = qs.lang || "tw";
    const ui = qs.ui || "tw";
    const baseUrl = (qs.base_url || "https://bc.godfat.org").replace(
      /\/+$/,
      ""
    );

    if (type !== "upcoming" && type !== "past") {
      return json(400, { error: "type 必須是 upcoming 或 past" });
    }

    const url = `${baseUrl}/?lang=${encodeURIComponent(
      lang
    )}&ui=${encodeURIComponent(ui)}`;
    const html = await fetchTextWithRetry(url, {
      timeoutMs: 30_000,
      retries: 3,
    });

    const events = parseEventsFromHomeHtml(
      html,
      type,
      Number.isFinite(limit) ? limit : 10
    );

    return json(200, { type, count: events.length, events });
  } catch (e: any) {
    return json(500, {
      error: "events function failed",
      details: String(e?.message || e),
    });
  }
};
