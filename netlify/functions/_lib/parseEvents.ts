// netlify/functions/_lib/parseEvents.ts
import * as cheerio from "cheerio";

import type { Event, PoolType } from "../../../shared/models";

import { normalizeText } from "./normalize";

// 特殊字串轉義，讓它能安全地被用在 RegExp 裡面。
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 從原始活動名稱一次解析出日期區間與去掉日期前綴後的短名稱。
function parseEventName(raw_name: string): {
  start_date: string | null;
  end_date: string | null;
  name: string;
} {
  const normalized = normalizeText(raw_name);
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return { start_date: null, end_date: null, name: "" };
  }

  // 取前幾段（跟你 Python 邏輯一致）
  const head = parts.slice(0, 6);
  let start_date: string | null;
  let end_date: string | null;
  const tildeIdx = head.indexOf("~");
  if (tildeIdx >= 0 && tildeIdx - 1 >= 0 && tildeIdx + 1 < head.length) {
    start_date = head[tildeIdx - 1].replace(/:$/, "");
    end_date = head[tildeIdx + 1].replace(/:$/, "");
  } else {
    const single = head[0].replace(/:$/, "");
    start_date = single;
    end_date = single;
  }

  const start = String(start_date || "").trim();
  const end = String(end_date || "").trim();

  const patterns: RegExp[] = [];

  if (start && end && start !== end) {
    patterns.push(
      new RegExp(`^${escapeRegExp(start)}\\s*~\\s*${escapeRegExp(end)}:?\\s*`),
    );
  }
  if (start) {
    patterns.push(new RegExp(`^${escapeRegExp(start)}:?\\s*`));
  }
  if (end && end !== start) {
    patterns.push(new RegExp(`^${escapeRegExp(end)}:?\\s*`));
  }

  for (const pattern of patterns) {
    const next = normalized.replace(pattern, "").trim();
    if (next && next !== normalized) {
      return { start_date, end_date, name: next };
    }
  }

  return { start_date, end_date, name: normalized };
}

// 由活動名稱判斷卡池類型
function inferPoolTypeFromEventName(nameRaw: string): PoolType {
  const name = normalizeText(nameRaw);

  if (name.includes("傳說轉蛋")) return "legend";
  if (name.includes("白金轉蛋")) return "platinum";

  // 保守：也支援英文關鍵字（以防 ui/lang 變動）
  const lower = name.toLowerCase();
  if (lower.includes("legend")) return "legend";
  if (lower.includes("platinum")) return "platinum";

  return "normal";
}

// 解析HTML有關於卡池分類的資訊（通常是從活動頁面抓來的HTML）
export function parseEventsFromHomeHtml(
  html: string,
  type: "upcoming" | "past",
  limit?: number | null,
): Event[] {
  const $ = cheerio.load(html);

  const label = type === "upcoming" ? "Upcoming:" : "Past:";
  const options = $(`.events optgroup[label="${label}"] option`);

  const out: Event[] = [];
  const seen = new Set<string>();

  const hasLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0;

  options.each((_, el) => {
    // if (type === "past" && out.length >= limit) return;
    if (hasLimit && out.length >= (limit as number)) return false;
    const value = normalizeText($(el).attr("value"));
    const raw_name = normalizeText($(el).text());

    if (!value || !raw_name) return;

    const key = `${value}__${raw_name}`;
    if (seen.has(key)) return;
    seen.add(key);

    const { start_date, end_date, name } = parseEventName(raw_name);
    const pool_type = inferPoolTypeFromEventName(raw_name);

    out.push({
      value,
      name,
      raw_name,
      start_date,
      end_date,
      pool_type,
    });
  });

  return out;
}
