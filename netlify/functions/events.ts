/**
 * netlify/functions/events.ts
 */
import type { Handler } from "@netlify/functions";

import { fetchTextWithRetry } from "./_lib/http";
import { parseEventsFromHomeHtml } from "./_lib/parseEvents";
import { getBcServerEnv } from "./_lib/env";

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

/**
 * 只信任前端傳入的 qs.limit
 * - 沒傳/空字串/非數字/<=0 => null（不限制）
 */
function parseLimit(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
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
    const env = getBcServerEnv();
    const qs = event.queryStringParameters || {};

    const type = (qs.type || "upcoming").toLowerCase() as "upcoming" | "past";
    if (type !== "upcoming" && type !== "past") {
      return json(400, { error: "type 必須是 upcoming 或 past" });
    }

    const lang = String(qs.lang ?? "").trim() || env.lang;
    const ui = String(qs.ui ?? "").trim() || env.ui;
    const baseUrl = (String(qs.base_url ?? "").trim() || env.baseUrl).replace(
      /\/+$/,
      ""
    );

    // 不從 env 讀 limit：只看前端 qs.limit
    const limit = parseLimit(qs.limit); // null = 不限制

    const url = `${baseUrl}/?lang=${encodeURIComponent(
      lang
    )}&ui=${encodeURIComponent(ui)}`;
    const html = await fetchTextWithRetry(url, {
      timeoutMs: 30_000,
      retries: 3,
    });

    const events = parseEventsFromHomeHtml(html, type, limit);
    return json(200, { type, count: events.length, events });
  } catch (e: any) {
    return json(500, {
      error: "events function failed",
      details: String(e?.message || e),
    });
  }
};
