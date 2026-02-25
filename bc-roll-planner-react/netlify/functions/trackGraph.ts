/**
 * Netlify Function: trackGraph
 */
import type { Handler } from "@netlify/functions";
import type { Event, PoolType } from "../../shared/models";

import { buildTrackGraphFromCells } from "./_lib/buildGraph";
import { fetchTextWithRetry } from "./_lib/http";
import {
  findTracksTable,
  parseTrackCellsFromTableHtml,
} from "./_lib/parseTrackTable";
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

    const seed = (qs.seed || "").trim();
    const eventValue = (qs.event || "").trim();
    const count = Number(qs.count || "");

    if (!seed) return json(400, { error: "缺少 seed" });
    if (!eventValue) return json(400, { error: "缺少 event" });
    if (!Number.isFinite(count) || count <= 0) {
      return json(400, { error: "count 必須是正整數" });
    }

    const lang = String(qs.lang ?? "").trim() || env.lang;
    const ui = String(qs.ui ?? "").trim() || env.ui;
    const baseUrl = (String(qs.base_url ?? "").trim() || env.baseUrl).replace(
      /\/+$/,
      "",
    );

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

    const name = qs.name ? String(qs.name) : eventValue;
    const pool_type = (qs.pool_type || "normal") as PoolType;

    const ev: Event = {
      value: eventValue,
      name,
      start_date: qs.start_date ? String(qs.start_date) : null,
      end_date: qs.end_date ? String(qs.end_date) : null,
      pool_type,
    };

    const graph = buildTrackGraphFromCells({
      seed,
      count,
      event: ev,
      raw_cells,
    });

    return json(200, { graph }, 60);
  } catch (e: any) {
    return json(500, {
      error: "trackGraph function failed",
      details: String(e?.message || e),
    });
  }
};
