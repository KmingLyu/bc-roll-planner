import type { Handler } from "@netlify/functions";
import * as cheerio from "cheerio";

type EventItem = {
  value: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

function normalizeText(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractDatesFromEventName(name: string): { start: string | null; end: string | null } {
  const parts = normalizeText(name).split(" ").filter(Boolean);
  if (parts.length === 0) return { start: null, end: null };

  const head = parts.slice(0, 6);
  const tildeIdx = head.indexOf("~");
  if (tildeIdx >= 1 && tildeIdx + 1 < head.length) {
    const start = head[tildeIdx - 1].replace(/:$/, "");
    const end = head[tildeIdx + 1].replace(/:$/, "");
    return { start, end };
  }

  const single = head[0].replace(/:$/, "");
  return { start: single || null, end: single || null };
}

export const handler: Handler = async (event) => {
  // 固定 headers 型別：永遠都是 Record<string, string>
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const qs = event.queryStringParameters ?? {};
    const lang = (qs.lang || "tw").trim();
    const ui = (qs.ui || "tw").trim();
    const type = (qs.type || "upcoming").trim(); // upcoming | past

    const url = `https://bc.godfat.org/?lang=${encodeURIComponent(lang)}&ui=${encodeURIComponent(ui)}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });

    if (!resp.ok) {
      return {
        statusCode: 502,
        headers: baseHeaders,
        body: JSON.stringify({ error: `Upstream HTTP ${resp.status}` }),
      };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const selector =
      type === "past"
        ? '.events optgroup[label="Past:"] option'
        : '.events optgroup[label="Upcoming:"] option';

    const out: EventItem[] = [];
    const seen = new Set<string>();

    $(selector).each((_, el) => {
      const opt = $(el);
      const value = normalizeText(opt.attr("value") || "");
      const name = normalizeText(opt.text() || "");
      if (!value || !name) return;

      const key = `${value}||${name}`;
      if (seen.has(key)) return;
      seen.add(key);

      const { start, end } = extractDatesFromEventName(name);
      out.push({ value, name, start_date: start, end_date: end });
    });

    return {
      statusCode: 200,
      headers: {
        ...baseHeaders,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ url, type, events: out }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  }
};
