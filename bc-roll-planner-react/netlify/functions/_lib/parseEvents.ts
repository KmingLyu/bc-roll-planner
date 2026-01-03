import * as cheerio from "cheerio";
import { normalizeText } from "./normalize";
import type { Event } from "./buildGraph";

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

    out.push({
      value,
      name,
      start_date,
      end_date,
    });
  });

  return out;
}
