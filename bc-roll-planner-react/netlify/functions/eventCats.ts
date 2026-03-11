/**
 * Netlify Function: eventCats
 */
import type { Handler } from "@netlify/functions";
import type { Event, PoolType } from "../../shared/models";

import { fetchTextWithRetry } from "./_lib/http";
import { parseEventCatsFromHtml } from "./_lib/parseEventCats";
import { getBcServerEnv } from "./_lib/env";

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
    const env = getBcServerEnv();
    const qs = evt.queryStringParameters || {};

    const eventValue = (qs.event || "").trim();
    if (!eventValue) return json(400, { error: "缺少 event" });

    const lang = String(qs.lang ?? "").trim() || env.lang;
    const ui = String(qs.ui ?? "").trim() || env.ui;
    const baseUrl = (String(qs.base_url ?? "").trim() || env.baseUrl).replace(
      /\/+$/,
      ""
    );

    const url =
      `${baseUrl}/?event=${encodeURIComponent(eventValue)}` +
      `&lang=${encodeURIComponent(lang)}` +
      `&ui=${encodeURIComponent(ui)}`;

    const html = await fetchTextWithRetry(url, {
      timeoutMs: 30_000,
      retries: 3,
    });

    const parsed = parseEventCatsFromHtml(html);

    const name = qs.name ? String(qs.name) : eventValue;
    const raw_name = qs.raw_name ? String(qs.raw_name) : name;
    const pool_type = (qs.pool_type || "normal") as PoolType;

    const ev: Event = {
      value: eventValue,
      name,
      raw_name,
      start_date: qs.start_date ? String(qs.start_date) : null,
      end_date: qs.end_date ? String(qs.end_date) : null,
      pool_type, // ✅ 必帶
    };

    return json(
      200,
      {
        event: ev,
        source: parsed.source,
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
