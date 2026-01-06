import * as cheerio from "cheerio";

import type { Event, PoolType } from "../../../shared/models";

import { normalizeText } from "./normalize";

function extractDatesFromEventName(name: string): {
  start_date: string | null;
  end_date: string | null;
} {
  const parts = normalizeText(name).split(" ").filter(Boolean);
  if (parts.length === 0) return { start_date: null, end_date: null };

  // 取前幾段（跟你 Python 邏輯一致）
  const head = parts.slice(0, 6);
  const tildeIdx = head.indexOf("~");
  if (tildeIdx >= 0 && tildeIdx - 1 >= 0 && tildeIdx + 1 < head.length) {
    const start_date = head[tildeIdx - 1].replace(/:$/, "");
    const end_date = head[tildeIdx + 1].replace(/:$/, "");
    return { start_date, end_date };
  }

  const single = head[0].replace(/:$/, "");
  return { start_date: single, end_date: single };
}

/** 由活動名稱判斷卡池類型 */
function inferPoolTypeFromEventName(nameRaw: string): PoolType {
  const name = normalizeText(nameRaw);

  // 先判斷傳說（通常比白金更「特殊」；避免同時命中時被白金吃掉）
  if (name.includes("傳說")) return "legend";
  if (name.includes("白金")) return "platinum";

  // 保守：也支援英文關鍵字（以防 ui/lang 變動）
  const lower = name.toLowerCase();
  if (lower.includes("legend")) return "legend";
  if (lower.includes("platinum")) return "platinum";

  return "normal";
}

export function parseEventsFromHomeHtml(
  html: string,
  type: "upcoming" | "past",
  limit = 10
): Event[] {
  const $ = cheerio.load(html);

  const label = type === "upcoming" ? "Upcoming:" : "Past:";
  const options = $(`.events optgroup[label="${label}"] option`);

  const out: Event[] = [];
  const seen = new Set<string>();

  options.each((_, el) => {
    if (type === "past" && out.length >= limit) return;

    const value = normalizeText($(el).attr("value"));
    const name = normalizeText($(el).text());

    if (!value || !name) return;

    const key = `${value}__${name}`;
    if (seen.has(key)) return;
    seen.add(key);

    const { start_date, end_date } = extractDatesFromEventName(name);
    const pool_type = inferPoolTypeFromEventName(name);

    out.push({
      value,
      name,
      start_date,
      end_date,
      pool_type,
    });
  });

  return out;
}
