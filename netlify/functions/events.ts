/**
 * netlify/functions/events.ts
 */
import type { Handler } from "@netlify/functions";

import { fetchBcHtml } from "./_lib/bcClient";
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
    const qs = event.queryStringParameters || {};

    const type = (qs.type || "upcoming").toLowerCase() as "upcoming" | "past";
    if (type !== "upcoming" && type !== "past") {
      return json(400, { error: "type 必須是 upcoming 或 past" });
    }

    // 不從 env 讀 limit：只看前端 qs.limit
    const limit = parseLimit(qs.limit); // null = 不限制
    const html = await fetchBcHtml({ query: {}, lang: qs.lang, ui: qs.ui });

    const events = parseEventsFromHomeHtml(html, type, limit);
    return json(200, { type, count: events.length, events });
  } catch (e: unknown) {
    return json(500, {
      error: "events function failed",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
