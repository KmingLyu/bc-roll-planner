netlify/functions/_lib/buildGraph.ts
```
import type {
  ActionType,
  Edge,
  Event,
  PickCell,
  PositionNode,
  TrackGraph,
  Track,
  Rarity,
} from "../../../shared/models";
import {
  inferGuaranteedTo,
  nextPosId,
  otherTrack,
} from "../../../shared/models";

function normalizeRarity(r: string | null | undefined): Rarity | null {
  if (!r) return null;
  return (["rare", "supa", "uber_fest", "supa_fest"] as const).includes(
    r as any
  )
    ? (r as Rarity)
    : null;
}

export function buildTrackGraphFromCells(args: {
  seed: string;
  count: number;
  event: Event;
  raw_cells: Record<string, PickCell>;
}): TrackGraph {
  const { seed, count, event, raw_cells } = args;

  const baseIds = Object.keys(raw_cells)
    .filter((pid) => {
      const c = raw_cells[pid];
      return c && c.suffix === "" && (c.track === "A" || c.track === "B");
    })
    .sort((a, b) => {
      const ca = raw_cells[a];
      const cb = raw_cells[b];
      if (ca.pos !== cb.pos) return ca.pos - cb.pos;
      return ca.track.localeCompare(cb.track);
    });

  const nodes: Record<string, PositionNode> = {};

  for (const baseId of baseIds) {
    const baseCell = raw_cells[baseId];
    const pos = baseCell.pos;
    const track = baseCell.track as Track;

    const edges: Partial<Record<ActionType, Edge>> = {};

    // normal
    edges.normal = {
      action: "normal",
      to: nextPosId(pos, track),
      cat: baseCell.cat ?? null,
      rolls: 1,
      advance: 1,
      cost_rolls: 1,
      note: "normal roll",
      ref_from: baseCell.ref_from ?? null,
      source_pick_id: baseId,
    };

    // guaranteed (G)
    const gId = `${baseId}G`;
    const gCell = raw_cells[gId];
    if (gCell?.cat) {
      const to = (
        gCell.jump_to ||
        gCell.ref_from ||
        inferGuaranteedTo(pos, track)
      ).trim();

      edges.guaranteed = {
        action: "guaranteed",
        to,
        cat: gCell.cat,
        rolls: 11,
        advance: 10,
        cost_rolls: 11,
        note: gCell.jump_to
          ? `guaranteed ${gCell.jump_to}`
          : gCell.ref_from
          ? `guaranteed (ref_from ${gCell.ref_from})`
          : "guaranteed (inferred)",
        ref_from: gCell.ref_from ?? null,
        source_pick_id: gId,
      };
    }

    // switch_track (R)
    const rId = `${baseId}R`;
    const rCell = raw_cells[rId];
    if (rCell?.cat) {
      const to = (rCell.jump_to || `${pos + 1}${otherTrack(track)}`).trim();

      edges.switch_track = {
        action: "switch_track",
        to,
        cat: rCell.cat,
        rolls: 1,
        advance: 1,
        cost_rolls: 1,
        note: rCell.jump_to
          ? `switch_track ${rCell.jump_to}`
          : "switch_track (fallback)",
        ref_from: rCell.ref_from ?? null,
        source_pick_id: rId,
      };
    }

    nodes[baseId] = {
      id: baseId,
      pos,
      track,
      rarity: normalizeRarity(baseCell.rarity ?? null),
      edges,
    };
  }

  return {
    seed,
    count,
    event,
    nodes,
    raw_cells,
  };
}
```

netlify/functions/_lib/env.ts
```
// netlify/functions/_lib/env.ts

export type BcServerEnv = {
  ui: string;
  lang: string;
  baseUrl: string;
};

function readString(keys: string[], fallback: string): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// 後端只需要讀取 ui、lang、baseUrl，不需要pastEventLimit
export function getBcServerEnv(): BcServerEnv {
  const ui = readString(["BC_UI", "VITE_BC_UI"], "tw");
  const lang = readString(["BC_LANG", "VITE_BC_LANG"], "tw");
  const baseUrl = normalizeBaseUrl(
    readString(
      ["BC_GODFAT_BASE_URL", "VITE_BC_GODFAT_BASE_URL"],
      "https://bc.godfat.org"
    )
  );

  return { ui, lang, baseUrl };
}
```

netlify/functions/_lib/http.ts
```
export type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  headers?: Record<string, string>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchTextWithRetry(
  url: string,
  opt: FetchOptions = {}
): Promise<string> {
  const timeoutMs = opt.timeoutMs ?? 30_000;
  const retries = opt.retries ?? 3;
  const backoffMs = opt.backoffMs ?? 600;

  // 預設 header（模仿瀏覽器 + zh-TW）
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9",
    ...(opt.headers ?? {}),
  };

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      // 429 / 5xx：通常可重試
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `HTTP ${resp.status} ${
          resp.statusText
        } url=${url} body=${body.slice(0, 200)}`;
        if (attempt < retries && (resp.status === 429 || resp.status >= 500)) {
          await sleep(backoffMs * Math.pow(2, attempt));
          continue;
        }
        throw new Error(msg);
      }

      return await resp.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr ?? new Error("fetchTextWithRetry failed");
}
```

netlify/functions/_lib/normalize.ts
```
export function normalizeText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}
```

netlify/functions/_lib/parseEventCats.ts
```
import * as cheerio from "cheerio";
import type { Cat, CatTier } from "../../../shared/models";
import { normalizeText } from "./normalize";

function tierFromLabel(labelRaw: string): CatTier | null {
  const label = normalizeText(labelRaw).toLowerCase();
  if (label.startsWith("rare")) return "rare";
  if (label.startsWith("super")) return "super";
  if (label.startsWith("uber")) return "uber";
  if (label.startsWith("legendary")) return "legendary";
  return null;
}

type TierGroup = { tier: CatTier; cats: Cat[] };

function parseFromSelectId(html: string, selectId: string): TierGroup[] {
  const $ = cheerio.load(html);

  const $select = $(`select#${selectId}`);
  if (!$select.length) return [];

  const groups: TierGroup[] = [];
  $select.find("optgroup[label]").each((_, og) => {
    const label = normalizeText($(og).attr("label"));
    const tier = tierFromLabel(label);
    if (!tier) return;

    const cats: Cat[] = [];
    $(og)
      .find("option[value]")
      .each((__, opt) => {
        const v = normalizeText($(opt).attr("value"));
        const name = normalizeText($(opt).text());
        const id = Number(v);

        if (!Number.isFinite(id) || id <= 0) return;
        if (!name) return;

        cats.push({ id, name, tier });
      });

    groups.push({ tier, cats });
  });

  return groups;
}

/**
 * 解析 event 裡所有貓（只用 last_select）
 * - last_select：只需要 event / lang / ui
 * - find_select：需要 seed / count 才會出現（本專案改為不使用）
 */
export function parseEventCatsFromHtml(html: string): {
  source: "last_select" | "none";
  groups: TierGroup[];
  cats: Cat[]; // 扁平去重（以 id）
} {
  const groups = parseFromSelectId(html, "last_select");
  const source: "last_select" | "none" = groups.length ? "last_select" : "none";

  // 扁平 + 去重（以 id）
  const byId = new Map<number, Cat>();
  for (const g of groups) {
    for (const c of g.cats) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
  }

  const cats = Array.from(byId.values()).sort((a, b) => a.id - b.id);

  // groups 內也做一下去重（避免 HTML 重複 option）
  const cleanedGroups: TierGroup[] = groups.map((g) => {
    const seen = new Set<number>();
    const uniq: Cat[] = [];
    for (const c of g.cats) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniq.push(c);
      }
    }
    uniq.sort((a, b) => a.id - b.id);
    return { tier: g.tier, cats: uniq };
  });

  return { source, groups: cleanedGroups, cats };
}
```

netlify/functions/_lib/parseEvents.ts
```
// netlify/functions/_lib/parseEvents.ts
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
  // limit = 10
  limit?: number | null
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
```

netlify/functions/_lib/parseTrackTable.ts
```
import * as cheerio from "cheerio";

import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element as DomElement } from "domhandler";
import type { Cat, PickCell } from "../../../shared/models";

import { normalizeText } from "./normalize";

const PICK_ID_RE = /^(\d+)([AB])(.*)$/; // 1A, 1AG, 1BR
const ONCLICK_RE = /pick\('([^']+)'\)/; // pick('3A')
const JUMP_RE = /->\s*([0-9]+[AB])/; // -> 13B
const REF_RE = /<-\s*([0-9]+[AB])/; // <- 12A
const CATS_ID_RE = /\/cats\/(\d+)/; // /cats/123

const RARITY_CLASSES = ["uber_fest", "supa_fest", "supa", "rare"]; // 強到弱

export function findTracksTable(html: string): { tableHtml: string | null } {
  const $ = cheerio.load(html);

  let bestEl: AnyNode | null = null;

  $("table").each((_, t) => {
    const headers = $(t)
      .find("th")
      .toArray()
      .map((th) => normalizeText($(th as any).text()).toLowerCase());

    const headerLine = headers.join(" ");
    if (headerLine.includes("guaranteed") && headerLine.includes("alt")) {
      bestEl = t as unknown as AnyNode;
      return false; // break
    }
    return;
  });

  if (!bestEl) {
    const first = $("table").first();
    if (first.length > 0) bestEl = (first.get(0) as unknown as AnyNode) ?? null;
  }

  return { tableHtml: bestEl ? $.html(bestEl as any) : null };
}

function parsePickId(
  pickId: string
): { pos: number; track: "A" | "B"; suffix: string } | null {
  const m = PICK_ID_RE.exec(pickId);
  if (!m) return null;
  const pos = Number(m[1]);
  const track = m[2] as "A" | "B";
  const suffix = m[3] || "";
  return { pos, track, suffix };
}

function detectRarityFromClasses(classes: string[]): string | null {
  const s = new Set(classes || []);
  for (const r of RARITY_CLASSES) {
    if (s.has(r)) return r;
  }
  return null;
}

function extractJumpAndRef(text: string): {
  jump_to: string | null;
  ref_from: string | null;
} {
  const t = normalizeText(text);
  let jump_to: string | null = null;
  let ref_from: string | null = null;

  const jm = JUMP_RE.exec(t);
  if (jm) jump_to = jm[1];

  const rm = REF_RE.exec(t);
  if (rm) ref_from = rm[1];

  return { jump_to, ref_from };
}

/**
 * cheerio 版本差異很大：這裡用 domhandler 的 DomElement/AnyNode 最穩
 * - $: CheerioAPI 用來把原始 node 包回 cheerio 物件讀 text/attr
 * - $td: Cheerio<DomElement>
 */
function parseCatFromTd($: CheerioAPI, $td: Cheerio<DomElement>): Cat | null {
  const links = $td.find("a").toArray();
  if (links.length === 0) return null;

  let name = "";
  let desc = "";

  for (const a of links) {
    const $a = $(a as any);
    const txt = normalizeText($a.text());
    if (!txt || txt === "🐾") continue;
    name = txt;
    desc = normalizeText($a.attr("title"));
    break;
  }

  let id: number | null = null;
  for (const a of links) {
    const href = normalizeText($(a as any).attr("href"));
    const m = CATS_ID_RE.exec(href);
    if (m) {
      id = Number(m[1]);
      break;
    }
  }

  if (id != null && name) {
    return { id, name, desc };
  }
  return null;
}

export function parseTrackCellsFromTableHtml(
  tableHtml: string
): Record<string, PickCell> {
  const $ = cheerio.load(tableHtml);
  const cells: Record<string, PickCell> = {};

  $("td[onclick]").each((_, td) => {
    const $td = $(td as any) as Cheerio<DomElement>;

    const onclick = normalizeText($td.attr("onclick"));
    const m = ONCLICK_RE.exec(onclick || "");
    const pick_id = m ? m[1] : "";
    if (!pick_id) return;

    const parsed = parsePickId(pick_id);
    if (!parsed) return;

    const classes = (normalizeText($td.attr("class")) || "")
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const rarity = detectRarityFromClasses(classes);

    const rawText = normalizeText($td.text());
    const { jump_to, ref_from } = extractJumpAndRef(rawText);

    const cat = parseCatFromTd($, $td);

    cells[pick_id] = {
      pick_id,
      pos: parsed.pos,
      track: parsed.track,
      suffix: parsed.suffix,
      rarity,
      cat,
      jump_to,
      ref_from,
    };
  });

  return cells;
}
```

netlify/functions/eventCats.ts
```
/**
 * Netlify Function: eventCats
 */
import type { Handler } from "@netlify/functions";
import type { Event, PoolType } from "../../shared/models";

import { fetchTextWithRetry } from "./_lib/http";
import { parseEventCatsFromHtml } from "./_lib/parseEventCats";
import { normalizeText } from "./_lib/normalize";
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

/** 允許從 querystring 帶入 pool_type，否則從 name 推斷，最後 fallback normal */
function normalizePoolType(v: unknown): PoolType | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "normal" || s === "platinum" || s === "legend")
    return s as PoolType;
  return null;
}

function inferPoolTypeFromName(nameRaw: string): PoolType {
  const name = normalizeText(nameRaw);
  if (name.includes("傳說")) return "legend";
  if (name.includes("白金")) return "platinum";
  const lower = name.toLowerCase();
  if (lower.includes("legend")) return "legend";
  if (lower.includes("platinum")) return "platinum";
  return "normal";
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
    const pool_type =
      normalizePoolType(qs.pool_type) ?? inferPoolTypeFromName(name);

    const ev: Event = {
      value: eventValue,
      name,
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
```

netlify/functions/events.ts
```
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
```

netlify/functions/trackGraph.ts
```
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
import { normalizeText } from "./_lib/normalize";
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

/** 允許從 querystring 帶入 pool_type，否則從 name 推斷，最後 fallback normal */
function normalizePoolType(v: unknown): PoolType | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "normal" || s === "platinum" || s === "legend")
    return s as PoolType;
  return null;
}

function inferPoolTypeFromName(nameRaw: string): PoolType {
  const name = normalizeText(nameRaw);
  if (name.includes("傳說")) return "legend";
  if (name.includes("白金")) return "platinum";
  const lower = name.toLowerCase();
  if (lower.includes("legend")) return "legend";
  if (lower.includes("platinum")) return "platinum";
  return "normal";
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
      ""
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
    const pool_type =
      normalizePoolType(qs.pool_type) ?? inferPoolTypeFromName(name);

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
```

shared/models.ts
```
/**
 * shared/models.ts
 *
 * 前端 /Functions 共用型別（單一真實來源）
 */

export type CatTier = "rare" | "super" | "uber" | "legendary";

export type Cat = {
  id: number;
  name: string;
  desc?: string;

  // 貓咪本身稀有度（來自 select optgroup label）
  // - tracks table 解析出來的 cat 可能沒有 tier，因此設成 optional
  tier?: CatTier;
};

// 卡池類型（你要的源頭資訊)，由爬蟲根據name判斷
export type PoolType = "normal" | "platinum" | "legend";

export type Event = {
  value: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;

  pool_type: PoolType;
};

// - normal: 單抽
// - guaranteed: 10 連保底+1(會換線)
// - switch_track: 換線(因為重複貓咪導致)
export type ActionType = "normal" | "guaranteed" | "switch_track";

// 這裡的「稀有度」是序列/格子設定，不是貓本身稀有度
export type Rarity = "rare" | "supa" | "uber_fest" | "supa_fest";

export type Edge = {
  action: ActionType;
  to: string;
  cat?: Cat | null;

  rolls: number;
  advance: number;

  cost_rolls: number; // 目前 functions 仍保留

  note?: string;
  ref_from?: string | null;
  source_pick_id?: string | null; // e.g. "3AG" / "3AR"
};

export type PositionNode = {
  id: string; // "3A"
  pos: number;
  track: "A" | "B";
  rarity?: Rarity | null;

  // JSON 會長這樣：edges.normal / edges.guaranteed / edges.switch_track
  edges: Partial<Record<ActionType, Edge>>;
};

export type PickCell = {
  pick_id: string; // e.g. "3A", "3AG", "3AR", "3ARG"
  pos: number;
  track: "A" | "B";
  suffix: string; // "", "G", "R", "RG", "X"...（我們主要用到 "", "G", "R", "RG"）
  rarity?: string | null;

  cat?: Cat | null;

  jump_to?: string | null; // "13B"
  ref_from?: string | null; // "12A"
};

export type TrackGraph = {
  seed: string;
  count: number;
  event: Event;

  nodes: Record<string, PositionNode>;
  raw_cells: Record<string, PickCell>;
};

// -------------------------
// Small helpers (safe to share)
// -------------------------

export type Track = "A" | "B";

export function otherTrack(track: Track): Track {
  return track === "A" ? "B" : "A";
}

export function nextPosId(pos: number, track: Track): string {
  return `${pos + 1}${track}`;
}

export function inferGuaranteedTo(pos: number, track: Track): string {
  // bc.godfat 的 11 連（含保底）通常前進 10 格並換線
  // nA -> (n+10)B
  // nB -> (n+10)A
  return `${pos + 10}${otherTrack(track)}`;
}
```

src/api/eventCatsApi.ts
```
// src/api/eventCatsApi.ts
import { netlifyGet } from "./netlifyClient";
import type { Event, Cat, CatTier, PoolType } from "../../shared/models";

export type TierGroup = { tier: CatTier; cats: Cat[] };

export type EventCatsResponse = {
  event: Event;
  source: "last_select" | "none";
  count: number;
  groups: TierGroup[];
  cats: Cat[];
};

export async function fetchEventCats(params: {
  event: string;
  lang?: string;
  ui?: string;
  base_url?: string;

  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  pool_type?: PoolType;
}): Promise<EventCatsResponse> {
  return netlifyGet<EventCatsResponse>("eventCats", {
    event: params.event,
    lang: params.lang ?? "tw",
    ui: params.ui ?? "tw",
    base_url: params.base_url,

    name: params.name,
    start_date: params.start_date ?? undefined,
    end_date: params.end_date ?? undefined,
    pool_type: params.pool_type,
  });
}
```

src/api/eventsApi.ts
```
// src/api/eventsApi.ts
import { netlifyGet } from "./netlifyClient";
import type { Event } from "../../shared/models";

export type EventsType = "upcoming" | "past";

export type EventsResponse = {
  type: EventsType;
  count: number;
  events: Event[];
};

export async function fetchEvents(params: {
  type?: EventsType;
  limit?: number | null;
  lang?: string;
  ui?: string;
  base_url?: string;
}): Promise<EventsResponse> {
  return netlifyGet<EventsResponse>("events", {
    type: params.type ?? "upcoming",
    limit: params.limit ?? null,
    lang: params.lang ?? "tw",
    ui: params.ui ?? "tw",
    base_url: params.base_url, // optional
  });
}

export type EventsBothResponse = {
  upcoming: EventsResponse;
  past: EventsResponse;
};

export async function fetchEventsBoth(params: {
  pastLimit?: number | null;
  lang?: string;
  ui?: string;
  base_url?: string;
}): Promise<EventsBothResponse> {
  const lang = params.lang ?? "tw";
  const ui = params.ui ?? "tw";

  const [upcoming, past] = await Promise.all([
    fetchEvents({
      type: "upcoming",
      limit: null, // upcoming 通常不需要限制
      lang,
      ui,
      base_url: params.base_url,
    }),
    fetchEvents({
      type: "past",
      limit: params.pastLimit ?? null,
      lang,
      ui,
      base_url: params.base_url,
    }),
  ]);

  return { upcoming, past };
}
```

src/api/netlifyClient.ts
```
// src/api/netlifyClient.ts
type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function toQueryString(q: Query): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    // 擋掉 undefined 和 null
    if (v === null || v === undefined) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/**
 * Netlify Functions 在 dev / prod 都可用同一路徑
 * - /.netlify/functions/events
 * - /.netlify/functions/trackGraph
 */
export async function netlifyGet<T>(
  fnName: string,
  query: Query = {},
  init?: RequestInit
): Promise<T> {
  const url = `/.netlify/functions/${fnName}${toQueryString(query)}`;
  const resp = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await resp.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!resp.ok) {
    const msg =
      (payload as any)?.error ||
      (payload as any)?.message ||
      `HTTP ${resp.status}`;
    throw new ApiError(msg, resp.status, payload);
  }

  return payload as T;
}
```

src/api/trackGraphApi.ts
```
// src/api/trackGraphApi.ts
import { netlifyGet } from "./netlifyClient";
import type { TrackGraph, PoolType } from "../../shared/models";

export type TrackGraphResponse = {
  graph: TrackGraph;
};

export async function fetchTrackGraph(params: {
  seed: string;
  event: string;
  count: number;
  lang?: string;
  ui?: string;
  base_url?: string;

  // 這些只是寫進 graph.event 方便顯示
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  pool_type?: PoolType;
}): Promise<TrackGraphResponse> {
  return netlifyGet<TrackGraphResponse>("trackGraph", {
    seed: params.seed,
    event: params.event,
    count: params.count,
    lang: params.lang ?? "tw",
    ui: params.ui ?? "tw",
    base_url: params.base_url,

    name: params.name,
    start_date: params.start_date ?? undefined,
    end_date: params.end_date ?? undefined,
    pool_type: params.pool_type,
  });
}
```

src/App.tsx
```
import HomePage from "./pages/HomePage";

export default function App() {
  return <HomePage />;
}
```

src/components/cats/TargetCatsPicker.tsx
```
// src/components/cats/TargetCatsPicker.tsx
import type { TierGroup } from "../../hooks/useEventCats";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  // Checkbox,
  // FormControlLabel,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierLabel(tier: TierGroup["tier"]) {
  if (tier === "rare") return "Rare";
  if (tier === "super") return "Super";
  if (tier === "uber") return "Uber";
  return "Legendary";
}

export function TargetCatsPicker(props: {
  loadState: LoadState;
  error: string;
  groups: TierGroup[];

  selectedIds: number[];
  onChange: (next: number[]) => void;
  onClear: () => void;

  // ✅ 多欄 layout 控制（可調）
  minColWidth?: number; // 每個 item 最小寬度，越大欄越少
  dense?: boolean; // 更緊湊

  // ✅ 預留：未來顯示圖片/連結
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
  renderCatSecondary?: (catId: number) => React.ReactNode;
}) {
  const {
    loadState,
    error,
    groups,
    selectedIds,
    onChange,
    onClear,
    minColWidth = 220,
    dense = true,
    getCatHref,
    getCatImageUrl,
    renderCatSecondary,
  } = props;

  const selectedSet = new Set(selectedIds);

  function toggle(id: number, on: boolean) {
    if (on)
      onChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
    else onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          狀態：<b>{loadState}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          已選：<b>{selectedIds.length}</b>
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={onClear}
          disabled={!selectedIds.length}
        >
          清空已選
        </Button>
      </Stack>

      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">eventCats 錯誤：{error}</Alert>
      )}

      {loadState === "ok" && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            目前為「選到的所有 events 的貓咪聯集」。未來多選 events
            時，不用改這個元件。
          </Typography>

          <Stack spacing={1}>
            {groups.map((g) => (
              <Accordion
                key={g.tier}
                defaultExpanded={g.tier === "legendary" || g.tier === "uber"}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={800}>
                    {tierLabel(g.tier)}（{g.cats.length}）
                  </Typography>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`,
                      gap: dense ? 0.5 : 1,
                      alignItems: "start",
                    }}
                  >
                    {g.cats.map((c) => {
                      const checked = selectedSet.has(c.id);
                      const href = getCatHref?.(c.id);
                      const img = getCatImageUrl?.(c.id);

                      return (
                        <Box
                          key={c.id}
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={0}
                          onClick={() => toggle(c.id, !checked)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle(c.id, !checked);
                            }
                          }}
                          sx={{
                            // border: "0.1px dashed",
                            // borderColor: checked ? "primary.main" : "divider",
                            borderRadius: 2,

                            // 選到就整格變藍（按鈕按下去的感覺）
                            bgcolor: checked ? "primary.main" : "transparent",
                            color: checked
                              ? "primary.contrastText"
                              : "text.primary",

                            cursor: "pointer",
                            userSelect: "none",
                            px: dense ? 1 : 1.25,
                            py: dense ? 0.25 : 0.75,
                            minHeight: dense ? 44 : 56,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            transition:
                              "background-color .2s ease, border-color .2s ease, transform .16s ease",
                            "&:hover": {
                              bgcolor: checked
                                ? "primary.dark"
                                : "action.hover",
                              borderColor: checked
                                ? "primary.dark"
                                : "text.secondary",
                            },
                            "&:active": {
                              transform: "translateY(2px)",
                            },
                            "&:focus-visible": {
                              outline: "2px solid",
                              outlineColor: checked
                                ? "primary.contrastText"
                                : "primary.main",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={3}
                            alignItems="center"
                            sx={{ width: "100%", minWidth: 0 }}
                          >
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                // 沒圖時也跟著反白好看
                                bgcolor: checked
                                  ? "rgba(255,255,255,0.2)"
                                  : "action.selected",
                                color: checked
                                  ? "primary.contrastText"
                                  : "text.primary",
                              }}
                              src={img}
                              variant="rounded"
                            >
                              {c.name?.[0] ?? "?"}
                            </Avatar>

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                variant="body2"
                                noWrap
                                title={c.name}
                                sx={{ fontWeight: 600 }}
                              >
                                {href ? (
                                  <Link
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    underline="hover"
                                    color="inherit"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {c.name}
                                  </Link>
                                ) : (
                                  c.name
                                )}
                              </Typography>

                              <Typography
                                variant="caption"
                                sx={{
                                  color: checked
                                    ? "rgba(255,255,255,0.85)"
                                    : "text.secondary",
                                }}
                              >
                                #{c.id}
                              </Typography>
                            </Box>

                            {/* ✅ 移除打勾提示：不要 icon / 不要預留空位 */}

                            {renderCatSecondary ? (
                              <Box
                                sx={{ flexShrink: 0 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {renderCatSecondary(c.id)}
                              </Box>
                            ) : null}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}

            {!groups.length && (
              <Alert severity="warning">
                解析不到貓咪列表（eventCats 回傳可能為空）
              </Alert>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
```

src/components/events/EventsPicker.tsx
```
// src/components/events/EventsPicker.tsx
import type { Event } from "../../../shared/models";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  ListItemText,
  ListSubheader,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";
type EvKind = "upcoming" | "past";

export function EventsPicker(props: {
  loadState: LoadState;
  error: string;

  upcomingEvents: Event[];
  pastEvents: Event[];

  /** 多選 */
  value: string[];
  onChange: (next: string[]) => void;

  /** primary event：給 graph debug / simulator 用（planner 仍用全部 events） */
  primaryValue: string;
  onPrimaryChange: (v: string) => void;
}) {
  const {
    loadState,
    error,
    upcomingEvents,
    pastEvents,
    value,
    onChange,
    primaryValue,
    onPrimaryChange,
  } = props;

  const selectedSet = new Set(value);

  const findEvent = (v: string): Event | undefined =>
    upcomingEvents.find((e) => e.value === v) ??
    pastEvents.find((e) => e.value === v);

  const getKind = (v: string): EvKind | null => {
    if (upcomingEvents.some((e) => e.value === v)) return "upcoming";
    if (pastEvents.some((e) => e.value === v)) return "past";
    return null;
  };

  const selectedEvents = value
    .map((v) => findEvent(v))
    .filter(Boolean) as Event[];

  const renderValue = (selected: any) => {
    const arr = (selected as string[]) || [];
    if (!arr.length) return "（未選）";
    if (arr.length === 1) {
      const e = findEvent(arr[0]);
      return e ? `${e.name}` : arr[0];
    }
    return `已選 ${arr.length} 個 events`;
  };

  const renderMenuItem = (ev: Event, kind: EvKind) => {
    const checked = selectedSet.has(ev.value);

    return (
      <MenuItem key={ev.value} value={ev.value} dense>
        <Checkbox size="small" checked={checked} />
        <ListItemText
          primary={ev.name}
          slotProps={{
            primary: { noWrap: true, title: ev.name },
          }}
          sx={{ mr: 1 }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={kind === "upcoming" ? "Upcoming" : "Past"}
          sx={{ flexShrink: 0 }}
        />
      </MenuItem>
    );
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        {/* <Typography variant="body2" color="text.secondary">
          狀態：<b>{loadState}</b>
          ，Upcoming：{upcomingEvents.length}
          ，Past：{pastEvents.length}
        </Typography> */}
      </Stack>

      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">events 錯誤：{error}</Alert>
      )}

      <FormControl fullWidth size="small">
        <InputLabel id="event-multi-label">選擇卡池（多選）</InputLabel>
        <Select
          labelId="event-multi-label"
          multiple
          value={value}
          onChange={(e) => {
            const next = e.target.value as string[];
            onChange(next);
          }}
          input={<OutlinedInput label="選擇卡池（多選）" />}
          renderValue={renderValue}
          MenuProps={{ PaperProps: { sx: { maxHeight: 520 } } }}
        >
          <ListSubheader disableSticky>
            Upcoming（{upcomingEvents.length}）
          </ListSubheader>

          {upcomingEvents.length ? (
            upcomingEvents.map((ev) => renderMenuItem(ev, "upcoming"))
          ) : (
            <MenuItem disabled dense>
              <ListItemText primary="（沒有 upcoming events）" />
            </MenuItem>
          )}

          <Divider sx={{ my: 0.5 }} />

          <ListSubheader disableSticky>
            Past（{pastEvents.length}）
          </ListSubheader>

          {pastEvents.length ? (
            pastEvents.map((ev) => renderMenuItem(ev, "past"))
          ) : (
            <MenuItem disabled dense>
              <ListItemText primary="（沒有 past events）" />
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {!!value.length && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {selectedEvents.slice(0, 20).map((ev) => {
            const kind = getKind(ev.value);
            const suffix = kind === "past" ? "（Past）" : "";
            return (
              <Chip
                key={ev.value}
                size="small"
                label={`${ev.name}${suffix}`}
                onDelete={() => onChange(value.filter((v) => v !== ev.value))}
                variant="outlined"
                color="default"
              />
            );
          })}
          {value.length > 20 && (
            <Chip
              size="small"
              label={`+${value.length - 20}`}
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* <Typography variant="body2" color="text.secondary">
        Planner 會用「所有已選 events」一起規劃；Graph Debug / Simulator
        則用「主要 event」顯示。
      </Typography> */}
    </Stack>
  );
}
```

src/components/graph/GraphSummaryCard.tsx
```
// src/components/graph/GraphSummaryCard.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import {
  Alert,
  Box,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
  LinearProgress,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";

function safeJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function getNormalCatName(g: TrackGraph | null, posId: string): string {
  const node = g?.nodes?.[posId];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || "-";
}

export function GraphSummaryCard(props: {
  seedApplied: string;
  countApplied: number | null;
  selectedEventValue: string;

  graphState: LoadState;
  graphErr: string;
  graph: TrackGraph | null;
}) {
  const {
    seedApplied,
    countApplied,
    selectedEventValue,
    graphState,
    graphErr,
    graph,
  } = props;

  const [showRaw, setShowRaw] = useState(false);

  const nodesCount = useMemo(
    () => (graph ? Object.keys(graph.nodes || {}).length : 0),
    [graph]
  );
  const cat1A = useMemo(() => getNormalCatName(graph, "1A"), [graph]);
  const cat1B = useMemo(() => getNormalCatName(graph, "1B"), [graph]);

  const seedText = seedApplied.trim() ? seedApplied : "-";
  const countText =
    typeof countApplied === "number" &&
    Number.isFinite(countApplied) &&
    countApplied > 0
      ? String(countApplied)
      : "-";

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        目前參數：seed=<b>{seedText}</b>，count=<b>{countText}</b>，event=
        <b>{selectedEventValue || "-"}</b>
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          狀態：<b>{graphState}</b>
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showRaw}
              onChange={(e) => setShowRaw(e.target.checked)}
            />
          }
          label="顯示 raw JSON"
        />
      </Stack>

      {graphState === "loading" && <LinearProgress />}

      {graphState === "error" && (
        <Alert severity="error">trackGraph 錯誤：{graphErr}</Alert>
      )}

      {graphState === "idle" && (
        <Alert severity="info">
          尚未抓取 TrackGraph（按 Planner 時會自動抓最新）
        </Alert>
      )}

      {graphState === "ok" && graph && (
        <Box>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            <Typography>
              <b>nodes count</b>：{nodesCount}
            </Typography>
            <Typography>
              <b>1A normal</b>：{cat1A}
            </Typography>
            <Typography>
              <b>1B normal</b>：{cat1B}
            </Typography>
          </Stack>

          {showRaw && (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, overflow: "auto", maxHeight: 420 }}
            >
              <Typography
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  whiteSpace: "pre",
                }}
              >
                {safeJson(graph)}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Stack>
  );
}
```

src/components/inputs/SeedCountForm.tsx
```
// src/components/inputs/SeedCountForm.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export function SeedCountForm(props: {
  seedApplied: string;
  countApplied: number | null;
  onChange: (v: { seed: string; count: number | null }) => void;
}) {
  const { seedApplied, countApplied, onChange } = props;

  // Draft 用字串：可自然清空
  const [seedDraft, setSeedDraft] = useState<string>(seedApplied);
  const [countDraft, setCountDraft] = useState<string>(
    typeof countApplied === "number" ? String(countApplied) : ""
  );
  const [err, setErr] = useState<string>("");

  // 若父層值被外部改動（例如 reset），同步回 draft
  useEffect(() => {
    setSeedDraft(seedApplied);
  }, [seedApplied]);

  useEffect(() => {
    setCountDraft(typeof countApplied === "number" ? String(countApplied) : "");
  }, [countApplied]);

  // 解析/驗證：不合法也會產出「父層應該變成的值」（seed 可能為空、count 變 null）
  const parsed = useMemo(() => {
    const s = seedDraft.trim();
    const cRaw = countDraft.trim();

    // 要推回父層的值（不合法時也要推，才能 disable）
    const nextSeed = s;
    let nextCount: number | null = null;

    // 規則：只要 seed 或 count 任一為空 => 這裡不顯示錯誤
    // （但仍回傳 count=null，讓上層 hasSeedCount 變 false）
    if (!s || !cRaw) {
      return { seed: nextSeed, count: null, err: "" };
    }

    // 兩者都不空，才檢查數值合法性
    const n = Number(cRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return { seed: nextSeed, count: null, err: "count 必須是正整數" };
    }

    nextCount = Math.floor(n);
    return { seed: nextSeed, count: nextCount, err: "" };
  }, [seedDraft, countDraft]);

  // 任何輸入變動都同步回父層（不合法就回傳 count=null / seed=""）
  useEffect(() => {
    setErr(parsed.err);

    const sameSeed = parsed.seed === seedApplied;
    const sameCount = parsed.count === countApplied;
    if (sameSeed && sameCount) return;

    onChange({ seed: parsed.seed, count: parsed.count });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.seed, parsed.count, parsed.err]);

  return (
    <Stack spacing={1.5}>
      {/* <Typography variant="body2" color="text.secondary">
        直接輸入即可生效；若 seed / count 不完整或不合法，規劃按鈕會自動停用。
      </Typography> */}

      <Grid container spacing={2} sx={{ maxWidth: 640, width: "100%" }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="seed"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            size="small"
            placeholder="例如 1234"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="count"
            type="number"
            value={countDraft}
            onChange={(e) => setCountDraft(e.target.value)}
            size="small"
            inputProps={{ min: 1 }}
            placeholder="例如 120"
          />
        </Grid>
      </Grid>

      {err && <Alert severity="error">{err}</Alert>}
    </Stack>
  );
}
```

src/components/layout/ControlPanel.tsx
```
// src/components/layout/ControlPanel.tsx
import {
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

export type UiFlags = {
  showControlPanel: boolean;

  showSeedCount: boolean;
  seedCountCollapsed: boolean;

  showEvents: boolean;
  eventsCollapsed: boolean;

  showTargetCats: boolean;
  targetCatsCollapsed: boolean;

  showPlanner: boolean;
  plannerCollapsed: boolean;

  showGraphDebug: boolean;
  graphDebugCollapsed: boolean;

  showSimulator: boolean;
  simulatorCollapsed: boolean;
};

export function ControlPanel(props: {
  value: UiFlags;
  onChange: (next: UiFlags) => void;
}) {
  const { value, onChange } = props;

  function set<K extends keyof UiFlags>(key: K, v: UiFlags[K]) {
    onChange({ ...value, [key]: v });
  }

  const rows: Array<{ key: keyof UiFlags; label: string }> = [
    { key: "showSeedCount", label: "顯示 Seed/Count" },
    { key: "showEvents", label: "顯示 Events" },
    { key: "showTargetCats", label: "顯示 Target Cats" },
    { key: "showPlanner", label: "顯示 Planner" },
    { key: "showGraphDebug", label: "顯示 Graph Debug" },
    { key: "showSimulator", label: "顯示 Simulator" },
  ];

  return (
    <Card variant="outlined">
      <CardHeader
        title="顯示設定（快速開關區塊）"
        titleTypographyProps={{ fontWeight: 800 }}
        action={
          <FormControlLabel
            control={
              <Switch
                checked={value.showControlPanel}
                onChange={(e) => set("showControlPanel", e.target.checked)}
              />
            }
            label="顯示面板"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={1}>
          <FormGroup row>
            {rows.map((r) => (
              <FormControlLabel
                key={String(r.key)}
                control={
                  <Switch
                    checked={Boolean(value[r.key])}
                    onChange={(e) => set(r.key, e.target.checked as any)}
                  />
                }
                label={r.label}
              />
            ))}
          </FormGroup>

          <Typography variant="body2" color="text.secondary">
            收合狀態也可在各區塊標題列直接切換；未來做 UI/UX
            調整時，這裡可以很快關掉某些區塊。
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

src/components/layout/Section.tsx
```
// src/components/layout/Section.tsx
import type { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export function Section(props: {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;
  children: ReactNode;
}) {
  const { title, collapsed, onToggleCollapsed, onHide, children } = props;

  return (
    <Card variant="outlined">
      <CardHeader
        title={title}
        slotProps={{
          title: {
            variant: "h6", // h4/h5/h6/subtitle1/subtitle2/body1...
            component: "div", // 渲染成什麼 tag
            align: "left", // left/center/right/justify
            gutterBottom: true, // 下面留一點距離
            noWrap: true, // 單行省略
            sx: {
              fontWeight: 600,
              color: "text.third", // 或 "text.secondary"
              lineHeight: 1.2,
              letterSpacing: 0.2,
              mb: 0, // margin bottom
            },
          },
        }}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* {onHide && (
              <Tooltip title="隱藏此區塊">
                <IconButton onClick={onHide} size="small">
                  <VisibilityOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )} */}
            <Tooltip title={collapsed ? "展開" : "收合"}>
              <IconButton
                onClick={onToggleCollapsed}
                size="small"
                sx={{
                  transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 180ms ease",
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0 }}>{children}</CardContent>
      </Collapse>
    </Card>
  );
}
```

src/components/planner/PlannerRunBar.tsx
```
// src/components/planner/PlannerRunBar.tsx
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";

export function PlannerRunBar(props: {
  state: LoadState;
  onRun: () => void;
  disabled: boolean;
  hint?: string;
  error?: string;
}) {
  const { state, onRun, disabled, hint, error } = props;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="contained"
          onClick={onRun}
          disabled={disabled}
          startIcon={
            state === "loading" ? <CircularProgress size={16} /> : undefined
          }
        >
          開始執行
        </Button>

        <Typography variant="body2" color="text.secondary">
          狀態：<b>{state}</b>
        </Typography>

        {hint && (
          <Typography variant="body2" color="warning.main">
            {hint}
          </Typography>
        )}
      </Stack>

      {state === "error" && error && (
        <Alert severity="error">planner 錯誤：{error}</Alert>
      )}
      {state === "loading" && (
        <Alert severity="info">規劃中…（worker 計算中）</Alert>
      )}
    </Stack>
  );
}
```

src/components/planner/PlanResultInspector.tsx
```
// src/components/planner/PlanResultInspector.tsx
import type { PlanResult } from "../../core/planner";
import { Alert, Paper, Typography } from "@mui/material";

export function PlanResultInspector(props: {
  result: PlanResult;
  catNameById: Map<number, string>;
}) {
  const { result } = props;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        結果檢視（未來擴充用）
      </Typography>

      <Alert severity="info">
        這裡預計放：
        <ul style={{ margin: "8px 0 0 18px" }}>
          <li>目標貓命中清單：catId → 第一次命中的位置（cursor）→ 第幾步</li>
          <li>每一步的資源消耗增量（food/tickets/platinum/legend）</li>
          <li>
            每一步使用的卡池（pool_type）與動作（single/ten/guaranteed/switch）
          </li>
          <li>可點選 step 高亮對應 draws；必要時加圖片與連結</li>
        </ul>
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        （暫時資訊）steps={result.plan?.length ?? 0}，draws=
        {result.all_draws?.length ?? 0}
      </Typography>
    </Paper>
  );
}
```

src/components/planner/PlanResultSummary.tsx
```
// src/components/planner/PlanResultSummary.tsx
import type { PlanResult } from "../../core/planner";
import { Alert, Chip, Stack, Typography } from "@mui/material";

function fmtCost(cost: any): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

export function PlanResultSummary(props: {
  result: PlanResult;
  missingText: string;
}) {
  const { result, missingText } = props;

  return (
    <Stack spacing={1}>
      <Alert severity={result.success ? "success" : "warning"}>
        {result.success
          ? "成功：命中全部目標"
          : "未完全命中：顯示目前最佳部分解"}
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          label={`命中 ${result.targets_hit}/${result.targets_total}`}
          color={result.success ? "success" : "warning"}
          variant="outlined"
        />
        <Chip label={`最終位置 ${result.final_cursor_id}`} variant="outlined" />
        <Chip
          label={`花費 ${fmtCost(result.total_cost as any)}`}
          variant="outlined"
        />
        <Chip
          label={`steps ${result.plan?.length ?? 0} / draws ${
            result.all_draws?.length ?? 0
          }`}
          variant="outlined"
        />
      </Stack>

      {missingText && (
        <Typography variant="body2" color="text.secondary">
          缺少：{missingText}
        </Typography>
      )}
    </Stack>
  );
}
```

src/components/planner/PlanStepsTable.tsx
```
// src/components/planner/PlanStepsTable.tsx
import type { PlanResult } from "../../core/planner";
import {
  Avatar,
  Box,
  Collapse,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

function fmtCost(cost: any): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

export function PlanStepsTable(props: {
  result: PlanResult;

  // ✅ 預留：未來 planner 結果或 draws 要加圖片/連結
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
}) {
  const { result, getCatHref, getCatImageUrl } = props;
  const plan = (result.plan || []) as any[];

  const [openRow, setOpenRow] = React.useState<Record<number, boolean>>({});

  if (!plan.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 0.5 }}>
          Plan Steps
        </Typography>
        <Typography color="text.secondary">
          沒有 step（可能資源不足或 graph 無法走位）
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        Plan Steps
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={42} />
              <TableCell width={56}>#</TableCell>
              <TableCell>event</TableCell>
              <TableCell>resource</TableCell>
              <TableCell>method</TableCell>
              <TableCell>from→to</TableCell>
              <TableCell>cost_inc</TableCell>
              <TableCell>draws</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {plan.map((st, i) => {
              const draws = st.draws || [];
              const short =
                draws
                  .slice(0, 6)
                  .map((d: any) =>
                    d.cat_id != null ? `${d.cat_name}#${d.cat_id}` : "-"
                  )
                  .join(", ") + (draws.length > 6 ? " ..." : "");

              const isOpen = Boolean(openRow[i]);

              return (
                <React.Fragment
                  key={`${i}-${st.event_value}-${st.start_cursor_id}`}
                >
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setOpenRow((p) => ({ ...p, [i]: !p[i] }))
                        }
                      >
                        {isOpen ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>

                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{st.event_value}</TableCell>
                    <TableCell>{st.resource}</TableCell>
                    <TableCell>{st.method}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        {st.start_cursor_id} → {st.end_cursor_id}
                      </Typography>
                    </TableCell>
                    <TableCell>{fmtCost(st.cost_inc as any)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {short || "-"}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0 }}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1.5 }}>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ mb: 1 }}
                          >
                            Draws（{draws.length}）
                          </Typography>

                          <Stack spacing={0.75}>
                            {draws.map((d: any, idx: number) => {
                              const href =
                                d.cat_id != null
                                  ? getCatHref?.(d.cat_id)
                                  : undefined;
                              const img =
                                d.cat_id != null
                                  ? getCatImageUrl?.(d.cat_id)
                                  : undefined;

                              return (
                                <Stack
                                  key={`${i}-${idx}-${d.from_pos_id}-${
                                    d.cat_id ?? "x"
                                  }`}
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{
                                    p: 1,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 1,
                                  }}
                                >
                                  <Avatar
                                    variant="rounded"
                                    src={img}
                                    sx={{ width: 28, height: 28 }}
                                  >
                                    {d.cat_name?.[0] ?? "?"}
                                  </Avatar>

                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    }}
                                  >
                                    {String(idx + 1).padStart(2, "0")}.{" "}
                                    {String(d.used).padEnd(12)} {d.from_pos_id}→
                                    {d.to_pos_id}{" "}
                                  </Typography>

                                  <Typography variant="body2">
                                    {d.cat_id != null ? (
                                      href ? (
                                        <Link
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          underline="hover"
                                        >
                                          {d.cat_name}#{d.cat_id}
                                        </Link>
                                      ) : (
                                        `${d.cat_name}#${d.cat_id}`
                                      )
                                    ) : (
                                      "-"
                                    )}
                                  </Typography>

                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: "auto" }}
                                  >
                                    src={d.source_pick_id ?? "-"}
                                  </Typography>
                                </Stack>
                              );
                            })}
                          </Stack>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 1 }}
                          >
                            ✅
                            未來你要更清楚標示：「此步在哪個位置執行、使用哪個卡池、資源消耗、命中目標位置」，
                            建議新增 view-model（不改 planner 核心資料）。
                          </Typography>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// 為了避免跟你專案 tsconfig 的 jsx runtime 設定衝突：顯式引入 React
import React from "react";
```

src/components/planner/ResourceForm.tsx
```
// src/components/planner/ResourceForm.tsx
import { Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import NumberField from "../tools/NumberField";

export type PlannerResources = {
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
};

export type PlannerConfig = {
  start_pos_id: string;
  max_expansions: number;
};

export function ResourceForm(props: {
  value: PlannerResources;
  cfg: PlannerConfig;
  onChange: (next: PlannerResources) => void;
  onCfgChange: (next: PlannerConfig) => void;
  showAdvanced?: boolean;
}) {
  const { value, cfg, onChange, onCfgChange, showAdvanced = false } = props;

  return (
    <Stack spacing={1.5}>
      {/* <Typography fontWeight={800}>輸入資源</Typography> */}

      <Grid container spacing={2} sx={{ maxWidth: 720, width: "100%" }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <NumberField
            label="金券"
            min={0}
            size="small"
            value={value.tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                tickets: Math.max(0, v ?? 0), // 清空時 v 會是 null，就當 0；同時保底不小於 0
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <NumberField
            label="白金券"
            min={0}
            size="small"
            value={value.platinum_tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                platinum_tickets: Math.max(0, v ?? 0), // 清空時 v 會是 null，就當 0；同時保底不小於 0
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <NumberField
            label="傳說券"
            min={0}
            size="small"
            value={value.legend_tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                legend_tickets: Math.max(0, v ?? 0), // 清空時 v 會是 null，就當 0；同時保底不小於 0
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <NumberField
            label="罐頭"
            min={0}
            size="small"
            value={value.food}
            onValueChange={(v) =>
              onChange({
                ...value,
                food: Math.max(0, v ?? 0), // 清空時 v 會是 null，就當 0；同時保底不小於 0
              })
            }
          />
        </Grid>

        {showAdvanced && (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="start_pos_id"
                value={cfg.start_pos_id}
                onChange={(e) =>
                  onCfgChange({ ...cfg, start_pos_id: e.target.value })
                }
                placeholder="例如 1A"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="max_expansions"
                type="number"
                inputProps={{ min: 1000, step: 1000 }}
                value={cfg.max_expansions}
                onChange={(e) =>
                  onCfgChange({
                    ...cfg,
                    max_expansions: Number(e.target.value),
                  })
                }
              />
            </Grid>
          </>
        )}
      </Grid>
    </Stack>
  );
}
```

src/components/simulator/SimulatorPanel.tsx
```
// src/components/simulator/SimulatorPanel.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import { simulateOnGraph, type DrawRecord } from "../../core/simulator";
import {
  Alert,
  Button,
  ButtonGroup,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export function SimulatorPanel(props: {
  graph: TrackGraph | null;
  graphReady: boolean;
}) {
  const { graph, graphReady } = props;

  const [cursorId, setCursorId] = useState<string>("1A");
  const [prevCatId, setPrevCatId] = useState<number | null>(null);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [text, setText] = useState<string>("");

  const eventValue = useMemo(() => graph?.event?.value ?? "", [graph]);

  function reset() {
    setCursorId("1A");
    setPrevCatId(null);
    setRecords([]);
    setText("");
  }

  function append(method: "single" | "ten") {
    if (!graphReady || !graph) {
      setText("");
      return;
    }

    try {
      const { records: newRecs, final_cursor } = simulateOnGraph({
        graph,
        actions: [{ event_value: eventValue, method }],
        start_pos_id: cursorId,
      });

      const last = newRecs.length ? newRecs[newRecs.length - 1] : null;
      const nextPrev = last?.cat_id ?? null;

      const baseStep = records.length;
      const rebased = newRecs.map((r) => ({ ...r, step: r.step + baseStep }));
      const nextAll = [...records, ...rebased];

      setRecords(nextAll);
      setCursorId(final_cursor.id);
      setPrevCatId(nextPrev);

      const lines = nextAll.map(
        (r) =>
          `${String(r.step).padStart(3, " ")} | ${r.method.padEnd(
            6
          )} | ${String(r.within_action_index).padStart(2, " ")} | ${
            r.from_pos_id
          } -> ${r.to_pos_id} | ${r.used} | ${r.cat_id ?? "-"} ${
            r.cat_name
          } | src=${r.source_pick_id ?? "-"}`
      );

      setText(
        [
          `cursor=${final_cursor.id}  prevCatId=${nextPrev ?? "-"}`,
          `total_records=${nextAll.length}`,
          "",
          ...lines,
        ].join("\n")
      );
    } catch (e: any) {
      setText(`simulate failed: ${String(e?.message || e)}`);
    }
  }

  return (
    <Stack spacing={1.5}>
      {!graphReady && (
        <Alert severity="info">
          需要 TrackGraph 才能使用（按 Planner 會自動抓最新）
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <ButtonGroup variant="outlined" size="small" disabled={!graphReady}>
          <Button onClick={() => append("single")}>單抽一次</Button>
          <Button onClick={() => append("ten")}>十連一次</Button>
        </ButtonGroup>

        <Button variant="text" onClick={reset}>
          重設（回到 1A）
        </Button>

        <Typography variant="body2" color="text.secondary">
          cursor：<b>{cursorId}</b>，prevCatId：<b>{prevCatId ?? "-"}</b>
          ，records：<b>{records.length}</b>
        </Typography>
      </Stack>

      {text && (
        <Paper
          variant="outlined"
          sx={{ p: 1.5, overflow: "auto", maxHeight: 420 }}
        >
          <Typography
            component="pre"
            sx={{
              m: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              whiteSpace: "pre",
            }}
          >
            {text}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
```

src/components/tools/NumberField.tsx
```
import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

/**
 * This component is a placeholder for FormControl to correctly set the shrink label state on SSR.
 */
function SSRInitialFilled(_: BaseNumberField.Root.Props) {
  return null;
}
SSRInitialFilled.muiName = "Input";

export default function NumberField({
  id: idProp,
  label,
  error,
  size = "medium",
  ...other
}: BaseNumberField.Root.Props & {
  label?: React.ReactNode;
  size?: "small" | "medium";
  error?: boolean;
}) {
  let id = React.useId();
  if (idProp) {
    id = idProp;
  }
  return (
    <BaseNumberField.Root
      {...other}
      render={(props, state) => (
        <FormControl
          size={size}
          ref={props.ref}
          disabled={state.disabled}
          required={state.required}
          error={error}
          variant="outlined"
        >
          {props.children}
        </FormControl>
      )}
    >
      <SSRInitialFilled {...other} />
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <BaseNumberField.Input
        id={id}
        render={(props, state) => (
          <OutlinedInput
            label={label}
            inputRef={props.ref}
            value={state.inputValue}
            onBlur={props.onBlur}
            onChange={props.onChange}
            onKeyUp={props.onKeyUp}
            onKeyDown={props.onKeyDown}
            onFocus={props.onFocus}
            slotProps={{
              input: props,
            }}
            endAdornment={
              <InputAdornment
                position="end"
                sx={{
                  flexDirection: "column",
                  maxHeight: "unset",
                  alignSelf: "stretch",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  ml: 0,
                  "& button": {
                    py: 0,
                    flex: 1,
                    borderRadius: 0.5,
                  },
                }}
              >
                <BaseNumberField.Increment
                  render={<IconButton size={size} aria-label="Increase" />}
                >
                  <KeyboardArrowUpIcon
                    fontSize={size}
                    sx={{ transform: "translateY(2px)" }}
                  />
                </BaseNumberField.Increment>

                <BaseNumberField.Decrement
                  render={<IconButton size={size} aria-label="Decrease" />}
                >
                  <KeyboardArrowDownIcon
                    fontSize={size}
                    sx={{ transform: "translateY(-2px)" }}
                  />
                </BaseNumberField.Decrement>
              </InputAdornment>
            }
            sx={{ pr: 0 }}
          />
        )}
      />
      {/* <FormHelperText sx={{ ml: 0, "&:empty": { mt: 0 } }}>
        Enter value between 10 and 40
      </FormHelperText> */}
    </BaseNumberField.Root>
  );
}
```

src/config/bcEnv.ts
```
// src/config/bcEnv.ts

type BcEnv = {
  ui: string;
  lang: string;
  pastEventLimit: number;
  baseUrl: string;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string") {
    throw new Error(`[bcEnv] Missing or non-string env: ${name}`);
  }
  const s = v.trim();
  if (!s) throw new Error(`[bcEnv] Empty env value: ${name}`);
  return s;
}

function mustPosInt(v: unknown, name: string): number {
  if (typeof v !== "string") {
    throw new Error(`[bcEnv] Missing env: ${name}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`[bcEnv] Invalid positive number env: ${name}, got: ${v}`);
  }
  return Math.floor(n);
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// ✅ 重點：用「靜態欄位」讀 VITE_*（不要用 import.meta.env[key]）
const E = import.meta.env;

export const BC_ENV: BcEnv = {
  ui: mustString(E.VITE_BC_UI, "VITE_BC_UI"),
  lang: mustString(E.VITE_BC_LANG, "VITE_BC_LANG"),
  pastEventLimit: mustPosInt(
    E.VITE_BC_PAST_EVENT_LIMIT,
    "VITE_BC_PAST_EVENT_LIMIT"
  ),
  baseUrl: normalizeBaseUrl(
    mustString(E.VITE_BC_GODFAT_BASE_URL, "VITE_BC_GODFAT_BASE_URL")
  ),
};

// DEBUG
if (E.DEV) {
  // eslint-disable-next-line no-console
  console.log("[BC_ENV]", {
    VITE_BC_UI: E.VITE_BC_UI,
    VITE_BC_LANG: E.VITE_BC_LANG,
    VITE_BC_PAST_EVENT_LIMIT: E.VITE_BC_PAST_EVENT_LIMIT,
    VITE_BC_GODFAT_BASE_URL: E.VITE_BC_GODFAT_BASE_URL,
    parsed: BC_ENV,
  });
}
```

src/core/planner.ts
```
import type {
  TrackGraph,
  PositionNode,
  Edge,
  Cat,
  PoolType,
} from "../../shared/models";
import { parsePosId } from "./utils";
import { chooseEdgeForSingleDraw } from "./simulator";

export type ResourceType =
  | "ticket"
  | "platinum_ticket"
  | "legend_ticket"
  | "food";
export type PlanMethod = "single" | "ten";

/** pool_type 從 graph.event.pool_type 讀 */
export type EventMeta = {
  event_value: string;
};

export type PlannerState = {
  cursor_id: string;
  prev_cat_id: number | null;
  tickets_left: number;
  platinum_left: number;
  legend_left: number;
  food_left: number;
  mask: number;
};

// (equiv_cost, food_used, ticket_used, platinum_used, legend_used)
export type Cost = [number, number, number, number, number];

export type DrawHit = {
  cat_id: number | null;
  cat_name: string;
  cat_desc: string;
  used: "normal" | "switch_track" | "guaranteed";
  from_pos_id: string;
  to_pos_id: string;
  source_pick_id?: string | null;
  note?: string;
};

export type PlanStep = {
  event_value: string;
  pool_type: PoolType;
  resource: ResourceType;
  method: PlanMethod;
  cost_inc: Cost;
  draws: DrawHit[];
  start_cursor_id: string;
  end_cursor_id: string;
  start_prev_cat_id: number | null;
  end_prev_cat_id: number | null;
};

export type PlanResult = {
  success: boolean;
  plan: PlanStep[];
  final_cursor_id: string;
  final_prev_cat_id: number | null;

  targets_total: number;
  targets_hit: number;
  targets_hit_ids: number[];
  targets_missing_ids: number[];

  total_cost: Cost;
  tickets_used: number;
  equiv_cost: number;
  platinum_used: number;
  legend_used: number;
  food_used: number;

  all_draws: DrawHit[];
};

export class PlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerError";
  }
}

// -------------------------
// Config
// -------------------------
export type PlannerConfig = {
  // 等價成本（預設都視為一次單抽=150）
  weights?: Partial<
    Record<
      | "ticket_single"
      | "platinum_single"
      | "legend_single"
      | "food_single"
      | "food_ten",
      number
    >
  >;

  // 十連允許的池類型（通常只有 normal）
  allow_ten_pools?: PoolType[];

  // 每種池允許哪些 action_key
  allowed_actions_by_pool?: Partial<Record<PoolType, string[]>>;

  // 搜尋上限（避免極端狀況）
  max_expansions?: number;
};

function normalizeConfig(cfg?: PlannerConfig): Required<PlannerConfig> {
  const weights = {
    ticket_single: 150,
    platinum_single: 200, // 設貴一點，優先使用金券/罐頭
    legend_single: 300, // 設更貴一點，優先使用白金券/金券/罐頭
    food_single: 150,
    food_ten: 1500,
    ...(cfg?.weights || {}),
  };

  const allowed_actions_by_pool: Record<PoolType, string[]> = {
    normal: ["ticket_single", "food_single", "food_ten"],
    platinum: ["platinum_single"],
    legend: ["legend_single"],
    ...(cfg?.allowed_actions_by_pool || {}),
  } as any;

  return {
    weights,
    allow_ten_pools: cfg?.allow_ten_pools ?? ["normal"],
    allowed_actions_by_pool,
    max_expansions: cfg?.max_expansions ?? 2_000_000,
  };
}

function isActionAllowed(
  cfg: Required<PlannerConfig>,
  pool: PoolType,
  actionKey: string
): boolean {
  const allowed = cfg.allowed_actions_by_pool[pool];
  return Array.isArray(allowed) ? allowed.includes(actionKey) : false;
}

// -------------------------
// Cost helpers
// -------------------------
function addCost(a: Cost, b: Cost): Cost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]];
}

function costIncForAction(
  cfg: Required<PlannerConfig>,
  actionKey: string
): Cost {
  const equiv = Number(cfg.weights[actionKey as keyof typeof cfg.weights] ?? 0);
  if (actionKey === "food_single") return [equiv, 150, 0, 0, 0];
  if (actionKey === "food_ten") return [equiv, 1500, 0, 0, 0];
  if (actionKey === "ticket_single") return [equiv, 0, 1, 0, 0];
  if (actionKey === "platinum_single") return [equiv, 0, 0, 1, 0];
  if (actionKey === "legend_single") return [equiv, 0, 0, 0, 1];
  throw new PlannerError(`未知 action_key=${actionKey}`);
}

// lexicographic compare
function costLess(a: Cost, b: Cost): boolean {
  for (let i = 0; i < 5; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

function costEq(a: Cost, b: Cost): boolean {
  return (
    a[0] === b[0] &&
    a[1] === b[1] &&
    a[2] === b[2] &&
    a[3] === b[3] &&
    a[4] === b[4]
  );
}

// -------------------------
// Target mask helpers
// -------------------------
function normalizeTargetIds(targets: Array<number | Cat>): number[] {
  const out: number[] = [];
  for (const t of targets) {
    if (typeof t === "number") out.push(t);
    else if (t && typeof (t as any).id === "number") out.push((t as any).id);
    else throw new PlannerError(`targets 只支援 number(cat_id) 或 Cat`);
  }
  // 去重但保序
  const seen = new Set<number>();
  const uniq: number[] = [];
  for (const x of out) {
    if (!seen.has(x)) {
      seen.add(x);
      uniq.push(x);
    }
  }
  return uniq;
}

function buildTargetIndex(targetIds: number[]): Map<number, number> {
  const m = new Map<number, number>();
  targetIds.forEach((cid, i) => m.set(cid, i));
  return m;
}

function applyHit(
  mask: number,
  targetIndex: Map<number, number>,
  catId: number | null
): number {
  if (catId == null) return mask;
  const i = targetIndex.get(catId);
  if (i == null) return mask;
  return mask | (1 << i);
}

function maskToHitIds(mask: number, targetIds: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < targetIds.length; i++) {
    if (((mask >> i) & 1) === 1) out.push(targetIds[i]);
  }
  return out;
}

function bitCount32(n: number): number {
  // JS number is 53-bit safe integer, but our mask is for target count; typically small
  let x = n >>> 0;
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

// -------------------------
// Draw simulation (single / ten)
// -------------------------
function catPayload(cat?: Cat | null): {
  id: number | null;
  name: string;
  desc: string;
} {
  if (!cat) return { id: null, name: "-", desc: "" };
  return { id: cat.id, name: cat.name, desc: cat.desc || "" };
}

function simulateSingleTransition(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
}): { next_cursor_id: string; next_prev: number | null; hit: DrawHit } {
  const { graph, cursor_id, prev_cat_id } = params;
  const node = graph.nodes?.[cursor_id] as PositionNode | undefined;
  if (!node) {
    throw new PlannerError(
      `[${graph.event.value}] 找不到位置 ${cursor_id}（count 不夠或資料缺漏）`
    );
  }

  const { edge, used } = chooseEdgeForSingleDraw(node, prev_cat_id);
  const p = catPayload(edge.cat);

  const hit: DrawHit = {
    cat_id: p.id,
    cat_name: p.name,
    cat_desc: p.desc,
    used,
    from_pos_id: cursor_id,
    to_pos_id: edge.to,
    source_pick_id: edge.source_pick_id ?? null,
    note: edge.note || "",
  };

  const next_cursor_id = parsePosId(edge.to).id;
  const next_prev = p.id;
  return { next_cursor_id, next_prev, hit };
}

function simulateTenTransition(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
}): { end_cursor_id: string; end_prev: number | null; draws: DrawHit[] } {
  const { graph } = params;
  const start_cursor_id = params.cursor_id;

  const startNode = graph.nodes?.[start_cursor_id] as PositionNode | undefined;
  if (!startNode)
    throw new PlannerError(
      `[${graph.event.value}] 找不到十連起點 ${start_cursor_id}`
    );

  const gEdge = (startNode.edges as any)?.guaranteed as Edge | undefined;
  const hasGuaranteed = !!(gEdge && gEdge.cat);

  const draws: DrawHit[] = [];
  let cur = params.cursor_id;
  let prev = params.prev_cat_id;

  // 10 抽：用單抽規則
  for (let i = 0; i < 10; i++) {
    const node = graph.nodes?.[cur] as PositionNode | undefined;
    if (!node)
      throw new PlannerError(
        `[${graph.event.value}] 找不到位置 ${cur}（count 不夠或資料缺漏）`
      );

    const { edge, used } = chooseEdgeForSingleDraw(node, prev);
    const p = catPayload(edge.cat);

    draws.push({
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used,
      from_pos_id: cur,
      to_pos_id: edge.to,
      source_pick_id: edge.source_pick_id ?? null,
      note: edge.note || "",
    });

    cur = parsePosId(edge.to).id;
    prev = p.id;
  }

  // 保底第 11 隻 + 結算落點
  if (hasGuaranteed && gEdge) {
    const p = catPayload(gEdge.cat);
    draws.push({
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used: "guaranteed",
      from_pos_id: start_cursor_id,
      to_pos_id: "-",
      source_pick_id: gEdge.source_pick_id ?? null,
      note: gEdge.note || "guaranteed bonus",
    });

    const finalTo = String(gEdge.to || "").trim();
    if (!finalTo) {
      throw new PlannerError(
        `[${graph.event.value}] guaranteed edge 沒有 to，無法結算十連落點`
      );
    }
    cur = parsePosId(finalTo).id;
    prev = p.id;
  }

  return { end_cursor_id: cur, end_prev: prev, draws };
}

// -------------------------
// Dijkstra Min-Heap
// -------------------------
type PQItem = { cost: Cost; seq: number; key: string; state: PlannerState };

class MinHeap {
  private a: PQItem[] = [];
  size() {
    return this.a.length;
  }
  push(x: PQItem) {
    this.a.push(x);
    this.up(this.a.length - 1);
  }
  pop(): PQItem | undefined {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      this.down(0);
    }
    return top;
  }
  private less(i: number, j: number) {
    const A = this.a[i],
      B = this.a[j];
    if (!costEq(A.cost, B.cost)) return costLess(A.cost, B.cost);
    return A.seq < B.seq;
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
        i = p;
      } else break;
    }
  }
  private down(i: number) {
    const n = this.a.length;
    while (true) {
      let m = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m !== i) {
        [this.a[i], this.a[m]] = [this.a[m], this.a[i]];
        i = m;
      } else break;
    }
  }
}

// -------------------------
// State key / parent
// -------------------------
function stateKey(s: PlannerState): string {
  // prev_cat_id 可能為 null
  return [
    s.cursor_id,
    s.prev_cat_id == null ? "-" : String(s.prev_cat_id),
    s.tickets_left,
    s.platinum_left,
    s.legend_left,
    s.food_left,
    s.mask,
  ].join("|");
}

type ParentInfo = { prevKey: string | null; step: PlanStep | null };

// -------------------------
// Main planner
// -------------------------
export function planMinCost(params: {
  graphs_by_event: Record<string, TrackGraph>;
  events: EventMeta[];
  target_cats: Array<number | Cat>;
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
  start_pos_id?: string; // default "1A"
  cfg?: PlannerConfig;
}): PlanResult {
  const cfg = normalizeConfig(params.cfg);

  const targetIds = normalizeTargetIds(params.target_cats);
  const targetIndex = buildTargetIndex(targetIds);
  const allMask = (1 << targetIds.length) - 1;

  const startCursor = parsePosId(params.start_pos_id || "1A");

  const startState: PlannerState = {
    cursor_id: startCursor.id,
    prev_cat_id: null,
    tickets_left: Math.max(0, Math.floor(params.tickets || 0)),
    platinum_left: Math.max(0, Math.floor(params.platinum_tickets || 0)),
    legend_left: Math.max(0, Math.floor(params.legend_tickets || 0)),
    food_left: Math.max(0, Math.floor(params.food || 0)),
    mask: 0,
  };

  const INF: Cost = [10 ** 18, 10 ** 18, 10 ** 18, 10 ** 18, 10 ** 18];

  const dist = new Map<string, Cost>();
  const parent = new Map<string, ParentInfo>();
  const stateByKey = new Map<string, PlannerState>();

  const startKey = stateKey(startState);
  dist.set(startKey, [0, 0, 0, 0, 0]);
  parent.set(startKey, { prevKey: null, step: null });
  stateByKey.set(startKey, startState);

  let bestGoalKey: string | null = null;
  let bestGoalCost: Cost = INF;

  let bestPartialKey = startKey;
  let bestPartialCost: Cost = [0, 0, 0, 0, 0];

  const pq = new MinHeap();
  let seq = 0;
  pq.push({
    cost: [0, 0, 0, 0, 0],
    seq: seq++,
    key: startKey,
    state: startState,
  });

  let expansions = 0;

  // caches: (event|cursor|prev) -> result
  const singleCache = new Map<
    string,
    { next_cursor_id: string; next_prev: number | null; hit: DrawHit }
  >();
  const tenCache = new Map<
    string,
    { end_cursor_id: string; end_prev: number | null; draws: DrawHit[] }
  >();

  function betterPartial(
    aMask: number,
    aCost: Cost,
    bMask: number,
    bCost: Cost
  ): boolean {
    const aBits = bitCount32(aMask);
    const bBits = bitCount32(bMask);
    if (aBits !== bBits) return aBits > bBits;
    return costLess(aCost, bCost);
  }

  // relax state
  function relax(
    ns: PlannerState,
    fromKey: string,
    curCost: Cost,
    inc: Cost,
    step: PlanStep
  ) {
    const nk = stateKey(ns);
    const newCost = addCost(curCost, inc);
    const old = dist.get(nk) || INF;

    if (costLess(newCost, old)) {
      dist.set(nk, newCost);
      parent.set(nk, { prevKey: fromKey, step });
      stateByKey.set(nk, ns);
      pq.push({ cost: newCost, seq: seq++, key: nk, state: ns });
    }
  }

  while (pq.size()) {
    const curItem = pq.pop()!;
    const curKey = curItem.key;
    const curCost = curItem.cost;
    const s = curItem.state;

    const bestKnown = dist.get(curKey) || INF;
    if (!costEq(curCost, bestKnown)) continue;

    expansions++;
    if (expansions > cfg.max_expansions) break;

    // goal check
    if (s.mask === allMask) {
      if (costLess(curCost, bestGoalCost)) {
        bestGoalCost = curCost;
        bestGoalKey = curKey;
      }
      // Dijkstra：第一個到 goal 即最小
      break;
    }

    // partial tracking
    if (
      betterPartial(
        s.mask,
        curCost,
        stateByKey.get(bestPartialKey)!.mask,
        bestPartialCost
      )
    ) {
      bestPartialKey = curKey;
      bestPartialCost = curCost;
    }

    // expand neighbors
    for (const meta of params.events) {
      const ev = meta.event_value;
      const graph = params.graphs_by_event[ev];
      if (!graph) continue;

      /** 直接從 graph.event.pool_type 讀 */
      const pool: PoolType = graph.event.pool_type ?? "normal";

      // ---- (A) 單抽 transition ----
      const key1 = `${ev}|${s.cursor_id}|${
        s.prev_cat_id == null ? "-" : s.prev_cat_id
      }`;
      let single = singleCache.get(key1);
      if (!single) {
        try {
          single = simulateSingleTransition({
            graph,
            cursor_id: s.cursor_id,
            prev_cat_id: s.prev_cat_id,
          });
          singleCache.set(key1, single);
        } catch {
          continue; // 此 event 在此 cursor 不可用
        }
      }

      const nextMask = applyHit(s.mask, targetIndex, single.hit.cat_id);
      const nextCursorId = single.next_cursor_id;
      const nextPrev = single.next_prev;

      // (A1) ticket single
      if (s.tickets_left >= 1 && isActionAllowed(cfg, pool, "ticket_single")) {
        const inc = costIncForAction(cfg, "ticket_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left - 1,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          resource: "ticket",
          method: "single",
          cost_inc: inc,
          draws: [single.hit],
          start_cursor_id: s.cursor_id,
          end_cursor_id: nextCursorId,
          start_prev_cat_id: s.prev_cat_id,
          end_prev_cat_id: nextPrev,
        });
      }

      // (A2) platinum single
      if (
        s.platinum_left >= 1 &&
        isActionAllowed(cfg, pool, "platinum_single")
      ) {
        const inc = costIncForAction(cfg, "platinum_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left - 1,
          legend_left: s.legend_left,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          resource: "platinum_ticket",
          method: "single",
          cost_inc: inc,
          draws: [single.hit],
          start_cursor_id: s.cursor_id,
          end_cursor_id: nextCursorId,
          start_prev_cat_id: s.prev_cat_id,
          end_prev_cat_id: nextPrev,
        });
      }

      // (A3) legend single
      if (s.legend_left >= 1 && isActionAllowed(cfg, pool, "legend_single")) {
        const inc = costIncForAction(cfg, "legend_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left - 1,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          resource: "legend_ticket",
          method: "single",
          cost_inc: inc,
          draws: [single.hit],
          start_cursor_id: s.cursor_id,
          end_cursor_id: nextCursorId,
          start_prev_cat_id: s.prev_cat_id,
          end_prev_cat_id: nextPrev,
        });
      }

      // (A4) food single
      if (s.food_left >= 150 && isActionAllowed(cfg, pool, "food_single")) {
        const inc = costIncForAction(cfg, "food_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left,
          food_left: s.food_left - 150,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          resource: "food",
          method: "single",
          cost_inc: inc,
          draws: [single.hit],
          start_cursor_id: s.cursor_id,
          end_cursor_id: nextCursorId,
          start_prev_cat_id: s.prev_cat_id,
          end_prev_cat_id: nextPrev,
        });
      }

      // ---- (B) ten：只允許 food + allow_ten_pools ----
      if (
        s.food_left >= 1500 &&
        cfg.allow_ten_pools.includes(pool) &&
        isActionAllowed(cfg, pool, "food_ten")
      ) {
        const key10 = `${ev}|${s.cursor_id}|${
          s.prev_cat_id == null ? "-" : s.prev_cat_id
        }`;
        let ten = tenCache.get(key10);
        if (!ten) {
          try {
            ten = simulateTenTransition({
              graph,
              cursor_id: s.cursor_id,
              prev_cat_id: s.prev_cat_id,
            });
            tenCache.set(key10, ten);
          } catch {
            // ten 不可用
            tenCache.set(key10, {
              end_cursor_id: "",
              end_prev: null,
              draws: [],
            });
            ten = { end_cursor_id: "", end_prev: null, draws: [] };
          }
        }

        if (ten.draws.length && ten.end_cursor_id) {
          let tenMask = s.mask;
          for (const d of ten.draws)
            tenMask = applyHit(tenMask, targetIndex, d.cat_id);

          const inc = costIncForAction(cfg, "food_ten");
          const ns: PlannerState = {
            cursor_id: ten.end_cursor_id,
            prev_cat_id: ten.end_prev,
            tickets_left: s.tickets_left,
            platinum_left: s.platinum_left,
            legend_left: s.legend_left,
            food_left: s.food_left - 1500,
            mask: tenMask,
          };

          relax(ns, curKey, curCost, inc, {
            event_value: ev,
            pool_type: pool,
            resource: "food",
            method: "ten",
            cost_inc: inc,
            draws: ten.draws,
            start_cursor_id: s.cursor_id,
            end_cursor_id: ten.end_cursor_id,
            start_prev_cat_id: s.prev_cat_id,
            end_prev_cat_id: ten.end_prev,
          });
        }
      }
    }
  }

  // -------------------------
  // pick best end state
  // -------------------------
  const success = bestGoalKey != null;
  const endKey = success ? bestGoalKey! : bestPartialKey;
  const endState = stateByKey.get(endKey)!;
  const endCost = dist.get(endKey) || bestPartialCost;

  // 回溯 plan
  const planSteps: PlanStep[] = [];
  let curKey = endKey;
  while (true) {
    const p = parent.get(curKey);
    if (!p || !p.prevKey || !p.step) break;
    planSteps.push(p.step);
    curKey = p.prevKey;
  }
  planSteps.reverse();

  // 統計
  const hits = maskToHitIds(endState.mask, targetIds);
  const hitSet = new Set(hits);
  const missing = targetIds.filter((cid) => !hitSet.has(cid));

  const allDraws: DrawHit[] = [];
  for (const st of planSteps) allDraws.push(...st.draws);

  const [equiv, foodUsed, tUsed, pUsed, lUsed] = endCost;

  return {
    success,
    plan: planSteps,
    final_cursor_id: endState.cursor_id,
    final_prev_cat_id: endState.prev_cat_id,

    targets_total: targetIds.length,
    targets_hit: bitCount32(endState.mask),
    targets_hit_ids: hits,
    targets_missing_ids: missing,

    total_cost: endCost,
    tickets_used: tUsed,
    equiv_cost: equiv,
    platinum_used: pUsed,
    legend_used: lUsed,
    food_used: foodUsed,

    all_draws: allDraws,
  };
}
```

src/core/simulator.ts
```
// src/core/simulator.ts
import type { TrackGraph, PositionNode, Edge, Cat } from "../../shared/models";
import { parsePosId, type Cursor, makeCursor } from "./utils";

// -------------------------
// 使用者輸入動作格式
// - single: 1抽
// - ten: 10連抽(是否有保底, 看起點是否有 guaranteed edge)
// -------------------------
export type Method = "single" | "ten";

export type SimAction = {
  event_value: string; // v1：你可先固定等於 graph.event.value
  method: Method;
};

export type DrawRecord = {
  step: number;
  event_value: string;
  method: Method;
  within_action_index: number;

  from_pos_id: string;

  // edge 類型: normal / switch_track / guaranteed
  used: "normal" | "switch_track" | "guaranteed";

  cat_id: number | null;
  cat_name: string;
  cat_desc: string;

  to_pos_id: string;

  source_pick_id?: string | null;
  note?: string;
};

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationError";
  }
}

// -------------------------
// helpers
// -------------------------
function catPayload(cat?: Cat | null): {
  id: number | null;
  name: string;
  desc: string;
} {
  if (!cat) return { id: null, name: "-", desc: "" };
  return { id: cat.id, name: cat.name, desc: cat.desc || "" };
}

/**
 * 規則:
 * - 先看 normal edge 抽到的貓
 * - if: 跟上一抽 cat_id 相同, 且有 switch_track edge, 且 rarity == "rare"
 *   就走 switch_track
 * - else: 走 normal
 */
export function chooseEdgeForSingleDraw(
  node: PositionNode,
  prevCatId: number | null
): { edge: Edge; used: "normal" | "switch_track" } {
  const normal = node.edges?.normal;
  if (!normal)
    throw new SimulationError(`位置 ${node.id} 缺少 normal edge, 無法單抽`);

  const normalCatId = normal.cat?.id ?? null;
  const sw = node.edges?.switch_track;

  const shouldSwitch =
    node.rarity === "rare" &&
    !!sw &&
    prevCatId !== null &&
    normalCatId !== null &&
    normalCatId === prevCatId;

  if (shouldSwitch && sw) return { edge: sw, used: "switch_track" };
  return { edge: normal, used: "normal" };
}

// -------------------------
// v1: 單一 graph 模擬
// -------------------------
export function simulateOnGraph(params: {
  graph: TrackGraph;
  actions: SimAction[];
  start_pos_id?: string; // default "1A"
}): { records: DrawRecord[]; final_cursor: Cursor } {
  const graph = params.graph;
  const actions = params.actions || [];
  const startPosId = params.start_pos_id || "1A";

  // v1 防呆：actions 裡 event_value 必須等於這張 graph 的 event.value
  for (const a of actions) {
    if (a.event_value !== graph.event.value) {
      throw new SimulationError(
        `v1 simulateOnGraph 只支援單一 graph。actions event_value=${a.event_value} != graph.event.value=${graph.event.value}`
      );
    }
    if (a.method !== "single" && a.method !== "ten") {
      throw new SimulationError(`未支援 method=${String((a as any).method)}`);
    }
  }

  let cursor = parsePosId(startPosId);
  let prevCatId: number | null = null;
  const out: DrawRecord[] = [];
  let step = 0;

  for (const act of actions) {
    const method = act.method;

    // 單抽
    if (method === "single") {
      const node = graph.nodes?.[cursor.id];
      if (!node) {
        throw new SimulationError(
          `[${act.event_value}] graph.nodes 找不到位置 ${cursor.id}(count 不夠或資料缺漏)`
        );
      }

      const { edge, used } = chooseEdgeForSingleDraw(node, prevCatId);
      step += 1;

      const p = catPayload(edge.cat);
      out.push({
        step,
        event_value: act.event_value,
        method,
        within_action_index: 1,
        from_pos_id: cursor.id,
        used,
        cat_id: p.id,
        cat_name: p.name,
        cat_desc: p.desc,
        to_pos_id: edge.to,
        source_pick_id: edge.source_pick_id ?? null,
        note: edge.note || "",
      });

      cursor = parsePosId(edge.to);
      prevCatId = p.id;
      continue;
    }

    // 10連抽
    if (method === "ten") {
      const startCursor = cursor;
      const startNode = graph.nodes?.[startCursor.id];
      if (!startNode) {
        throw new SimulationError(
          `[${act.event_value}] graph.nodes 找不到起點 ${startCursor.id}, 無法做 10連抽`
        );
      }

      const gEdge = startNode.edges?.guaranteed;
      const hasGuaranteed = !!(gEdge && gEdge.cat);

      // (1) 先做 10 抽：依單抽規則逐次走位
      for (let i = 1; i <= 10; i++) {
        const node = graph.nodes?.[cursor.id];
        if (!node) {
          throw new SimulationError(
            `[${act.event_value}] graph.nodes 找不到位置 ${cursor.id}(count 不夠或資料缺漏)`
          );
        }

        const { edge, used } = chooseEdgeForSingleDraw(node, prevCatId);
        step += 1;

        const p = catPayload(edge.cat);
        out.push({
          step,
          event_value: act.event_value,
          method,
          within_action_index: i,
          from_pos_id: cursor.id,
          used,
          cat_id: p.id,
          cat_name: p.name,
          cat_desc: p.desc,
          to_pos_id: edge.to,
          source_pick_id: edge.source_pick_id ?? null,
          note: edge.note || "",
        });

        cursor = parsePosId(edge.to);
        prevCatId = p.id;
      }

      // (2) 若起點有 guaranteed，才追加第 11 抽(保底)
      if (hasGuaranteed && gEdge) {
        step += 1;
        const p = catPayload(gEdge.cat);

        out.push({
          step,
          event_value: act.event_value,
          method,
          within_action_index: 11,
          from_pos_id: startCursor.id, // 來源: 起點的 G 欄(例如 1AG)
          used: "guaranteed",
          cat_id: p.id,
          cat_name: p.name,
          cat_desc: p.desc,
          to_pos_id: "-",
          source_pick_id: gEdge.source_pick_id ?? null,
          note: gEdge.note || "guaranteed bonus",
        });

        const finalTo = String(gEdge.to || "").trim();
        if (finalTo) {
          cursor = parsePosId(finalTo);
        } else {
          // fallback: +1 並換線（理論上不該發生，你的 function 幾乎都有 to）
          cursor = makeCursor(cursor.pos + 1, cursor.track === "A" ? "B" : "A");
        }

        prevCatId = p.id;
      }

      continue;
    }
  }

  return { records: out, final_cursor: cursor };
}

// -------------------------
// Convenience helpers（對齊 Python 的 estimate_required_counts/parse_actions）
// -------------------------
export function parseActions(raw: unknown): SimAction[] {
  if (!Array.isArray(raw)) throw new SimulationError("actions 必須是 array");
  const out: SimAction[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as any;
    if (!item || typeof item !== "object") {
      throw new SimulationError(`actions[${i + 1}] 必須是 object`);
    }
    const ev = String(item.event_value || "").trim();
    if (!ev) throw new SimulationError(`actions[${i + 1}] 缺少 event_value`);
    const method = item.method;
    if (method !== "single" && method !== "ten") {
      throw new SimulationError(
        `actions[${i + 1}].method 必須是 'single' 或 'ten', 但得到 ${String(
          method
        )}`
      );
    }
    out.push({ event_value: ev, method });
  }
  return out;
}

/**
 * v1 估算：single=1, ten=10（不算保底第11隻）
 * +20 buffer
 */
export function estimateRequiredCounts(actions: SimAction[]): number {
  let count = 0;
  for (const a of actions) {
    if (a.method === "single") count += 1;
    else if (a.method === "ten") count += 10;
    else
      throw new SimulationError(
        `未支援 method=${String((a as any).method)} 的估算`
      );
  }
  return count + 20;
}
```

src/core/utils.ts
```
// src/core/utils.ts
import type { Track } from "../../shared/models";

/**
 * Cursor（前端 core 用的最小版本）
 */
export type Cursor = {
  pos: number;
  track: Track;
  id: string; // `${pos}${track}`
};

const PICK_ID_RE = /^(\d+)([AB])(.*)$/;

/**
 * 解析像 "3A", "3AG", "3AR" 這類 pick_id
 * 回傳 (pos, track, suffix)
 */
export function parsePickId(pickId: string): {
  pos: number;
  track: Track;
  suffix: string;
} {
  const m = PICK_ID_RE.exec(String(pickId || "").trim());
  if (!m) throw new Error(`Invalid pick_id: ${pickId}`);
  const pos = Number(m[1]);
  const track = m[2] as Track;
  const suffix = m[3] || "";
  return { pos, track, suffix };
}

/**
 * 解析位置字串（只能是 base：例如 "3A"/"15B"）
 * - suffix 不允許
 */
export function parsePosId(posId: string): Cursor {
  const { pos, track, suffix } = parsePickId(posId);
  if (suffix) throw new Error(`Invalid pos_id (suffix not allowed): ${posId}`);
  return { pos, track, id: `${pos}${track}` };
}

export function makeCursor(pos: number, track: Track): Cursor {
  return { pos, track, id: `${pos}${track}` };
}
```

src/hooks/useEventCats.ts
```
// src/hooks/useEventCats.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "../../shared/models";
import { fetchEventCats } from "../api/eventCatsApi";
import { ApiError } from "../api/netlifyClient";

export type CatTier = "rare" | "super" | "uber" | "legendary";
export type UiCat = { id: number; name: string; tier?: CatTier };
export type TierGroup = { tier: CatTier; cats: UiCat[] };

type LoadState = "idle" | "loading" | "ok" | "error";

function tierOrder(t: CatTier): number {
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}

export function useEventCats(params: {
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  lang: string;
  ui: string;
}) {
  const { selectedEventValues, eventsByValue, lang, ui } = params;

  const [catsState, setCatsState] = useState<LoadState>("idle");
  const [catsErr, setCatsErr] = useState<string>("");
  const [tierGroups, setTierGroups] = useState<TierGroup[]>([]);

  const seqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedEventValues.length) {
        setCatsState("idle");
        setCatsErr("");
        setTierGroups([]);
        return;
      }

      const seq = ++seqRef.current;
      setCatsState("loading");
      setCatsErr("");
      setTierGroups([]);

      try {
        // 多事件：逐一抓，最後做聯集
        const results = await Promise.all(
          selectedEventValues.map(async (ev) => {
            const meta = eventsByValue.get(ev) || null;
            return fetchEventCats({
              event: ev,
              lang,
              ui,
              name: meta?.name ?? ev,
              start_date: meta?.start_date ?? null,
              end_date: meta?.end_date ?? null,
              pool_type: meta?.pool_type ?? "normal",
            });
          })
        );

        if (cancelled) return;
        if (seq !== seqRef.current) return;

        // union cats by id（tier 取更稀有者）
        const catMap = new Map<
          number,
          { id: number; name: string; tier: CatTier }
        >();

        for (const res of results) {
          const groups = (res.groups || []) as TierGroup[];
          for (const g of groups) {
            for (const cat of g.cats || []) {
              const existing = catMap.get(cat.id);
              if (!existing) {
                catMap.set(cat.id, {
                  id: cat.id,
                  name: cat.name,
                  tier: g.tier,
                });
              } else {
                const better = tierOrder(g.tier) < tierOrder(existing.tier);
                const next = better ? { ...existing, tier: g.tier } : existing;

                // 名稱以非空者為準（保守）
                if (!next.name && cat.name) {
                  catMap.set(cat.id, { ...next, name: cat.name });
                } else if (better) {
                  catMap.set(cat.id, next);
                }
              }
            }
          }
        }

        // regroup
        const grouped = new Map<CatTier, UiCat[]>();
        for (const x of catMap.values()) {
          const arr = grouped.get(x.tier) ?? [];
          arr.push({ id: x.id, name: x.name, tier: x.tier });
          grouped.set(x.tier, arr);
        }

        const tiers: CatTier[] = ["legendary", "uber", "super", "rare"];
        const out: TierGroup[] = tiers
          .filter((t) => grouped.has(t))
          .map((t) => {
            const cats = grouped.get(t) ?? [];
            cats.sort((a, b) => a.name.localeCompare(b.name));
            return { tier: t, cats };
          });

        setTierGroups(out);
        setCatsState("ok");
      } catch (e: any) {
        if (cancelled) return;
        setCatsState("error");
        setCatsErr(
          e instanceof ApiError
            ? `${e.message} (HTTP ${e.status})`
            : String(e?.message || e)
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedEventValues.join("|"), eventsByValue, lang, ui]);

  const allowedCatIdSet = useMemo(() => {
    if (!tierGroups.length) return null;
    const s = new Set<number>();
    for (const g of tierGroups) for (const c of g.cats) s.add(c.id);
    return s;
  }, [tierGroups]);

  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of tierGroups) for (const c of g.cats) m.set(c.id, c.name);
    return m;
  }, [tierGroups]);

  return { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById };
}
```

src/hooks/useEvents.ts
```
// src/hooks/useEvents.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "../../shared/models";
import { fetchEventsBoth } from "../api/eventsApi";
import { ApiError } from "../api/netlifyClient";

type LoadState = "idle" | "loading" | "ok" | "error";

export function useEvents(params: {
  pastLimit?: number | null;
  lang: string;
  ui: string;
}) {
  const { pastLimit, lang, ui } = params;

  const cleanPastLimit =
    typeof pastLimit === "number" && Number.isFinite(pastLimit) && pastLimit > 0
      ? pastLimit
      : undefined;

  const [eventsState, setEventsState] = useState<LoadState>("idle");
  const [eventsErr, setEventsErr] = useState<string>("");

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);

  // ✅ 合併 events：用 useMemo 穩定 reference，避免每次 render 都 new array
  const events = useMemo(() => {
    return [...upcomingEvents, ...pastEvents];
  }, [upcomingEvents, pastEvents]);

  // 避免快速刷新造成舊回應覆蓋新回應
  const seqRef = useRef(0);

  async function load() {
    const seq = ++seqRef.current;
    setEventsState("loading");
    setEventsErr("");

    try {
      const res = await fetchEventsBoth({
        pastLimit: cleanPastLimit ?? null,
        lang,
        ui,
      });

      if (seq !== seqRef.current) return;

      setUpcomingEvents(res.upcoming.events || []);
      setPastEvents(res.past.events || []);
      setEventsState("ok");
    } catch (e: any) {
      if (seq !== seqRef.current) return;

      setEventsState("error");
      setEventsErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanPastLimit, lang, ui]);

  return {
    eventsState,
    eventsErr,

    upcomingEvents,
    pastEvents,

    // ✅ 合併後的 events（上 upcoming 下 past）
    events,

    reloadEvents: load,
  };
}
```

src/hooks/usePlannerWorker.ts
```
// src/hooks/usePlannerWorker.ts
import { useEffect, useRef, useState } from "react";
import PlannerWorker from "../workers/planner.worker?worker";
import type { PlannerWorkerResponse } from "../workers/planner.worker";
import type { PlanResult } from "../core/planner";

type LoadState = "idle" | "loading" | "ok" | "error";
type WorkerResp = PlannerWorkerResponse;

type RunPayload =
  | { kind: "run"; req: any }
  | { kind: "errorOnly"; error: string };

export function usePlannerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  const [planState, setPlanState] = useState<LoadState>("idle");
  const [planErr, setPlanErr] = useState<string>("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  function ensureWorker() {
    if (!workerRef.current) workerRef.current = new PlannerWorker();
    return workerRef.current;
  }

  function resetPlan() {
    setPlanState("idle");
    setPlanErr("");
    setPlanResult(null);
  }

  // 先把狀態切到 loading（通常也順便清掉舊結果/錯誤）
  function setLoading() {
    setPlanState("loading");
    setPlanErr("");
    setPlanResult(null);
  }

  function runPlanner(payload: RunPayload) {
    if (payload.kind === "errorOnly") {
      setPlanState("error");
      setPlanErr(payload.error);
      setPlanResult(null);
      return;
    }

    const w = ensureWorker();
    const seq = ++seqRef.current;

    setPlanState("loading");
    setPlanErr("");
    setPlanResult(null);

    w.onmessage = (e: MessageEvent<WorkerResp>) => {
      if (seq !== seqRef.current) return;

      if (e.data.ok) {
        setPlanResult(e.data.result as any);
        setPlanState("ok");
      } else {
        setPlanResult(null);
        setPlanState("error");
        setPlanErr(e.data.error);
      }
    };

    w.postMessage(payload.req);
  }

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    planState,
    planErr,
    planResult,
    setLoading,
    runPlanner,
    resetPlan,
  };
}
```

src/hooks/useTrackGraphs.ts
```
// src/hooks/useTrackGraphs.ts
import { useRef, useState } from "react";
import type { Event, TrackGraph } from "../../shared/models";
import { fetchTrackGraph } from "../api/trackGraphApi";
import { ApiError } from "../api/netlifyClient";

type LoadState = "idle" | "loading" | "ok" | "error";

function isValidSeedCount(seed: string, count: number | null): boolean {
  const s = seed.trim();
  if (!s) return false;
  if (typeof count !== "number") return false;
  if (!Number.isFinite(count)) return false;
  if (count <= 0) return false;
  return true;
}

export function useTrackGraphs(params: {
  seed: string;
  count: number | null; // 可為 null
  selectedEventValues: string[];
  eventsByValue: Map<string, Event>;
  lang: string;
  ui: string;
}) {
  const { seed, count, selectedEventValues, eventsByValue, lang, ui } = params;

  const [graphState, setGraphState] = useState<LoadState>("idle");
  const [graphErr, setGraphErr] = useState<string>("");
  const [graphByEvent, setGraphByEvent] = useState<Record<string, TrackGraph>>(
    {}
  );

  const seqRef = useRef(0);

  // 保存最新結果，避免 click handler 讀到舊 state
  const latestGraphsRef = useRef<Record<string, TrackGraph>>({});

  function clearGraphs() {
    setGraphState("idle");
    setGraphErr("");
    setGraphByEvent({});
    latestGraphsRef.current = {};
  }

  // 回傳 next graphs
  async function fetchGraphs(): Promise<Record<string, TrackGraph>> {
    // 沒選 event：回到 idle，回傳空
    if (selectedEventValues.length === 0) {
      setGraphState("idle");
      setGraphErr("");
      latestGraphsRef.current = {};
      setGraphByEvent({});
      return {};
    }

    // seed/count 不合法：不要打 API、不要 throw，回到 idle，回傳空
    if (!isValidSeedCount(seed, count)) {
      setGraphState("idle");
      setGraphErr("");
      // 參數不完整就視為不可用，所以這裡乾脆也清空，避免 UI 誤顯示舊資料
      latestGraphsRef.current = {};
      setGraphByEvent({});
      return {};
    }

    const s = seed.trim();
    const c = count as number;

    const seq = ++seqRef.current;
    setGraphState("loading");
    setGraphErr("");

    try {
      const results = await Promise.all(
        selectedEventValues.map(async (ev) => {
          const meta = eventsByValue.get(ev) || null;
          const res = await fetchTrackGraph({
            seed: s,
            event: ev,
            count: c,
            lang,
            ui,
            name: meta?.name ?? ev,
            start_date: meta?.start_date ?? null,
            end_date: meta?.end_date ?? null,
            pool_type: meta?.pool_type ?? "normal",
          });
          return { ev, graph: res.graph };
        })
      );

      // 過期請求：不覆蓋 state，回傳最新已知結果
      if (seq !== seqRef.current) {
        return latestGraphsRef.current;
      }

      const next: Record<string, TrackGraph> = {};
      for (const r of results) next[r.ev] = r.graph;

      latestGraphsRef.current = next;
      setGraphByEvent(next);
      setGraphState("ok");
      return next;
    } catch (e: any) {
      // 過期請求失敗：不覆蓋最新狀態，回傳最新已知
      if (seq !== seqRef.current) {
        return latestGraphsRef.current;
      }

      setGraphState("error");
      setGraphErr(
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : String(e?.message || e)
      );
      throw e;
    }
  }

  return { graphState, graphErr, graphByEvent, fetchGraphs, clearGraphs };
}
```

src/main.tsx
```
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// import './index.css'
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

src/pages/HomePage.tsx
```
// src/pages/HomePage.tsx
import PlannerPage from "./PlannerPage";

export default function HomePage() {
  return <PlannerPage />;
}
```

src/pages/PlannerPage.tsx
```
// src/pages/PlannerPage.tsx
import { useEffect, useMemo, useState } from "react";

// MUI
import { Box, Container, Stack, Typography } from "@mui/material";
import PetsIcon from "@mui/icons-material/Pets";

// Models
import type { Event, TrackGraph } from "../../shared/models";

// APIs
import { ApiError } from "../api/netlifyClient";

// Hooks
import { useEvents } from "../hooks/useEvents";
import {
  useEventCats,
  type TierGroup,
  type CatTier,
} from "../hooks/useEventCats";
import { useTrackGraphs } from "../hooks/useTrackGraphs";
import { usePlannerWorker } from "../hooks/usePlannerWorker";

// Components
import { Section } from "../components/layout/Section";
import { ControlPanel, type UiFlags } from "../components/layout/ControlPanel";
import { SeedCountForm } from "../components/inputs/SeedCountForm";
import { EventsPicker } from "../components/events/EventsPicker";
import { TargetCatsPicker } from "../components/cats/TargetCatsPicker";
import { GraphSummaryCard } from "../components/graph/GraphSummaryCard";
import {
  ResourceForm,
  type PlannerResources,
  type PlannerConfig,
} from "../components/planner/ResourceForm";
import { PlannerRunBar } from "../components/planner/PlannerRunBar";
import { PlanResultSummary } from "../components/planner/PlanResultSummary";
import { PlanStepsTable } from "../components/planner/PlanStepsTable";
import { PlanResultInspector } from "../components/planner/PlanResultInspector";
import { SimulatorPanel } from "../components/simulator/SimulatorPanel";

// Planner types
import type { PlanResult } from "../core/planner";

// env
import { BC_ENV } from "../config/bcEnv";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierOrder(t: CatTier): number {
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}

function safeErrText(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  if (e && typeof e === "object" && "message" in e)
    return String((e as any).message);
  return String(e);
}

export default function PlannerPage() {
  // -------------------------
  // UI flags
  // -------------------------
  const [ui, setUi] = useState<UiFlags>({
    showControlPanel: false,

    showSeedCount: true,
    seedCountCollapsed: false,

    showEvents: true,
    eventsCollapsed: false,

    showTargetCats: true,
    targetCatsCollapsed: false,

    showPlanner: true,
    plannerCollapsed: false,

    showGraphDebug: false,
    graphDebugCollapsed: true,

    showSimulator: false,
    simulatorCollapsed: true,
  });

  // -------------------------
  // Seed/Count
  // -------------------------
  const [seedApplied, setSeedApplied] = useState<string>("");
  const [countApplied, setCountApplied] = useState<number | null>(null);

  // -------------------------
  // Events（一次載入 upcoming + past）
  // -------------------------
  const {
    eventsState,
    eventsErr,
    events,
    upcomingEvents,
    pastEvents,
    reloadEvents,
  } = useEvents({
    pastLimit: BC_ENV.pastEventLimit,
    lang: BC_ENV.lang,
    ui: BC_ENV.ui,
  });

  // 多選 values
  const [selectedEventValues, setSelectedEventValues] = useState<string[]>([]);

  // primary event：Graph Debug / Simulator 用
  const [primaryEventValue, setPrimaryEventValue] = useState<string>("");

  // 任何時候 selectedEventValues 改變：確保 primary 仍有效
  useEffect(() => {
    if (!selectedEventValues.length) {
      setPrimaryEventValue("");
      return;
    }
    if (
      !primaryEventValue ||
      !selectedEventValues.includes(primaryEventValue)
    ) {
      setPrimaryEventValue(selectedEventValues[0]);
    }
  }, [selectedEventValues, primaryEventValue]);

  // Map for easy lookup
  const eventsByValue = useMemo(() => {
    const m = new Map<string, Event>();
    for (const e of events) m.set(e.value, e);
    return m;
  }, [events]);

  // 是否設定了 seed/count
  const hasSeedCount = useMemo(() => {
    const okSeed = !!seedApplied.trim();
    const okCount =
      typeof countApplied === "number" &&
      Number.isFinite(countApplied) &&
      countApplied > 0;
    return okSeed && okCount;
  }, [seedApplied, countApplied]);

  // -------------------------
  // Target Cats：依 selectedEventValues 自動載入（多事件 union）
  // -------------------------
  const { catsState, catsErr, tierGroups, allowedCatIdSet, catNameById } =
    useEventCats({
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
      // base_url: BC_ENV.baseUrl,
    });

  const [targetCatIds, setTargetCatIds] = useState<number[]>([]);

  // 修剪：把已選但不在聯集中允許的 id 移除
  useEffect(() => {
    if (!allowedCatIdSet) return;
    setTargetCatIds((prev) => prev.filter((id) => allowedCatIdSet.has(id)));
  }, [allowedCatIdSet]);

  // -------------------------
  // Graph：按 Planner 前先 ensure 最新（多 events）
  // -------------------------
  const { graphState, graphErr, graphByEvent, fetchGraphs, clearGraphs } =
    useTrackGraphs({
      seed: seedApplied,
      count: countApplied, // number | null
      selectedEventValues,
      eventsByValue,
      lang: BC_ENV.lang,
      ui: BC_ENV.ui,
      // base_url: BC_ENV.baseUrl,
    });

  // 參數變動時清掉 graphs（避免舊 graph 造成誤解）
  useEffect(() => {
    clearGraphs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedApplied, countApplied, selectedEventValues.join("|")]);

  // Graph Debug / Simulator 用 primaryEventValue
  const activeGraph: TrackGraph | null = useMemo(() => {
    if (!primaryEventValue) return null;
    return graphByEvent[primaryEventValue] ?? null;
  }, [graphByEvent, primaryEventValue]);

  // -------------------------
  // Planner resources + cfg
  // -------------------------
  const [resources, setResources] = useState<PlannerResources>({
    tickets: 0,
    platinum_tickets: 0,
    legend_tickets: 0,
    food: 0,
  });

  const [plannerCfg, setPlannerCfg] = useState<PlannerConfig>({
    start_pos_id: "1A",
    max_expansions: 200000,
  });

  // -------------------------
  // Planner worker
  // -------------------------
  const { runPlanner, setLoading, planState, planErr, planResult, resetPlan } =
    usePlannerWorker();

  useEffect(() => {
    resetPlan();
  }, [resources, plannerCfg.start_pos_id, plannerCfg.max_expansions]);

  async function onClickPlanner() {
    if (!selectedEventValues.length) {
      resetPlan();
      return runPlanner({ kind: "errorOnly", error: "請先選擇至少一個 event" });
    }
    if (!hasSeedCount) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "請先在最上方套用 seed / count（count 必須為正整數）",
      });
    }
    if (!targetCatIds.length) {
      resetPlan();
      return runPlanner({ kind: "errorOnly", error: "請先選至少一隻目標貓" });
    }

    setLoading();

    let graphsByEvent: Record<string, TrackGraph>;
    try {
      graphsByEvent = await fetchGraphs();
    } catch (e) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: `取得 TrackGraph 失敗：${safeErrText(e)}`,
      });
    }

    // primary 的選法要保證在 selected 裡
    const primary =
      primaryEventValue && selectedEventValues.includes(primaryEventValue)
        ? primaryEventValue
        : selectedEventValues[0];

    const g = primary ? graphsByEvent[primary] : undefined;

    // 判斷 graph 有效性
    const ok = !!g && Object.keys(g.nodes ?? {}).length > 0;

    if (!ok) {
      resetPlan();
      return runPlanner({
        kind: "errorOnly",
        error: "主要 event 的 TrackGraph 不存在（可能抓取失敗或回傳為空）",
      });
    }

    runPlanner({
      kind: "run",
      req: {
        graphs_by_event: graphsByEvent,

        // 不再塞 pool_type，planner 會從 graphs_by_event[ev].event.pool_type 讀
        events: selectedEventValues.map((ev) => ({ event_value: ev })),

        target_cats: targetCatIds,

        tickets: Math.max(0, Math.floor(resources.tickets)),
        platinum_tickets: Math.max(0, Math.floor(resources.platinum_tickets)),
        legend_tickets: Math.max(0, Math.floor(resources.legend_tickets)),
        food: Math.max(0, Math.floor(resources.food)),

        start_pos_id: (plannerCfg.start_pos_id || "1A").trim(),
        cfg: {
          max_expansions: Math.max(1000, Math.floor(plannerCfg.max_expansions)),
        },
      },
    });
  }

  const missingText = useMemo(() => {
    if (!planResult?.targets_missing_ids?.length) return "";
    return (
      planResult.targets_missing_ids
        .slice(0, 12)
        .map((id) => `${catNameById.get(id) ?? "?"}#${id}`)
        .join(", ") + (planResult.targets_missing_ids.length > 12 ? " ..." : "")
    );
  }, [planResult, catNameById]);

  const tierGroupsSorted = useMemo(() => {
    const gs = [...(tierGroups as TierGroup[])];
    gs.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));
    return gs;
  }, [tierGroups]);

  // 預留：圖片/連結
  const getCatHref = (catId: number) => undefined as string | undefined;
  const getCatImageUrl = (catId: number) => undefined as string | undefined;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="h5" fontWeight={800}>
            🐾 貓咪大戰爭抽卡規劃（測試版）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            流程：輸入 seed/count → 選卡池(多選) → 選目標貓咪(多選) → 輸入資源 →
            執行抽卡規劃
          </Typography>
        </Stack>

        {/* Seed/Count */}
        {ui.showSeedCount && (
          <Section
            title="輸入seed/count、卡池"
            collapsed={ui.seedCountCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                seedCountCollapsed: !p.seedCountCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showSeedCount: false }))}
          >
            <Stack spacing={0.5}>
              <SeedCountForm
                seedApplied={seedApplied}
                countApplied={countApplied}
                onChange={({ seed, count }) => {
                  setSeedApplied(seed);
                  setCountApplied(count);
                }}
              />

              <EventsPicker
                loadState={eventsState as LoadState}
                error={eventsErr}
                upcomingEvents={upcomingEvents}
                pastEvents={pastEvents}
                value={selectedEventValues}
                onChange={(next) => setSelectedEventValues(next)}
                primaryValue={primaryEventValue}
                onPrimaryChange={(v) => setPrimaryEventValue(v)}
              />
            </Stack>
          </Section>
        )}

        {/* Target Cats */}
        {ui.showTargetCats && (
          <Section
            title="選擇目標貓咪"
            collapsed={ui.targetCatsCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                targetCatsCollapsed: !p.targetCatsCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showTargetCats: false }))}
          >
            <TargetCatsPicker
              loadState={catsState as LoadState}
              error={catsErr}
              groups={tierGroupsSorted}
              selectedIds={targetCatIds}
              onChange={setTargetCatIds}
              onClear={() => setTargetCatIds([])}
              getCatHref={getCatHref}
              getCatImageUrl={getCatImageUrl}
              minColWidth={220}
              dense
            />
          </Section>
        )}

        {/* Planner */}
        {ui.showPlanner && (
          <Section
            title="輸入資源"
            collapsed={ui.plannerCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({ ...p, plannerCollapsed: !p.plannerCollapsed }))
            }
            onHide={() => setUi((p) => ({ ...p, showPlanner: false }))}
          >
            <Stack spacing={2}>
              <ResourceForm
                value={resources}
                cfg={plannerCfg}
                onChange={setResources}
                onCfgChange={setPlannerCfg}
              />

              <PlannerRunBar
                state={planState as LoadState}
                onRun={onClickPlanner}
                disabled={
                  planState === "loading" ||
                  !selectedEventValues.length ||
                  !hasSeedCount ||
                  targetCatIds.length === 0
                }
                hint={
                  !selectedEventValues.length
                    ? "請先選至少一個 event"
                    : !hasSeedCount
                    ? "請先套用 seed / count"
                    : !targetCatIds.length
                    ? "請先選目標貓"
                    : ""
                }
                error={planState === "error" ? planErr : ""}
              />

              {planState === "ok" && planResult && (
                <Stack spacing={2}>
                  <PlanResultSummary
                    result={planResult as PlanResult}
                    missingText={missingText}
                  />
                  <PlanResultInspector
                    result={planResult as PlanResult}
                    catNameById={catNameById}
                  />
                  <PlanStepsTable
                    result={planResult as PlanResult}
                    getCatHref={getCatHref}
                    getCatImageUrl={getCatImageUrl}
                  />
                </Stack>
              )}
            </Stack>
          </Section>
        )}

        {/* Graph Debug（用 primary） */}
        {ui.showGraphDebug && (
          <Section
            title="TrackGraph Debug（主要 event）"
            collapsed={ui.graphDebugCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                graphDebugCollapsed: !p.graphDebugCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showGraphDebug: false }))}
          >
            <GraphSummaryCard
              seedApplied={seedApplied}
              countApplied={countApplied}
              selectedEventValue={primaryEventValue}
              graphState={graphState as LoadState}
              graphErr={graphErr}
              graph={activeGraph}
            />
          </Section>
        )}

        {/* Simulator（用 primary） */}
        {ui.showSimulator && (
          <Section
            title="Simulator（主要 event；可隱藏）"
            collapsed={ui.simulatorCollapsed}
            onToggleCollapsed={() =>
              setUi((p) => ({
                ...p,
                simulatorCollapsed: !p.simulatorCollapsed,
              }))
            }
            onHide={() => setUi((p) => ({ ...p, showSimulator: false }))}
          >
            <SimulatorPanel
              graph={activeGraph}
              graphReady={!!activeGraph && graphState === "ok"}
            />
          </Section>
        )}
      </Stack>
    </Container>
  );
}
```

src/workers/planner.worker.ts
```
/// <reference lib="webworker" />

// src/workers/planner.worker.ts
import type { TrackGraph, Cat } from "../../shared/models";
import type { EventMeta, PlannerConfig, PlanResult } from "../core/planner";
import { planMinCost } from "../core/planner";

export type PlannerWorkerRequest = {
  graphs_by_event: Record<string, TrackGraph>;
  events: EventMeta[];
  target_cats: Array<number | Cat>;
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
  start_pos_id?: string;
  cfg?: PlannerConfig;
};

export type PlannerWorkerResponse =
  | { ok: true; result: PlanResult }
  | { ok: false; error: string };

const ctx: DedicatedWorkerGlobalScope = self as any;

function normalizeError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;

  // 常見：Error
  const anyE = e as any;
  const msg = anyE?.message ? String(anyE.message) : String(e);

  // 盡量把 stack 留下（方便你在 devtools 看）
  const stack = anyE?.stack ? String(anyE.stack) : "";
  return stack ? `${msg}\n${stack}` : msg;
}

function assertValidRequest(d: any): asserts d is PlannerWorkerRequest {
  if (!d || typeof d !== "object")
    throw new Error("PlannerWorkerRequest is empty");

  if (!d.graphs_by_event || typeof d.graphs_by_event !== "object") {
    throw new Error("PlannerWorkerRequest.graphs_by_event is missing");
  }
  if (!Array.isArray(d.events)) {
    throw new Error("PlannerWorkerRequest.events is missing");
  }
  if (!Array.isArray(d.target_cats)) {
    throw new Error("PlannerWorkerRequest.target_cats is missing");
  }

  // resources：至少要是 number（允許 0）
  for (const k of [
    "tickets",
    "platinum_tickets",
    "legend_tickets",
    "food",
  ] as const) {
    if (typeof d[k] !== "number" || Number.isNaN(d[k])) {
      throw new Error(`PlannerWorkerRequest.${k} must be a number`);
    }
  }
}

ctx.addEventListener("message", (ev: MessageEvent<PlannerWorkerRequest>) => {
  try {
    const data: any = ev?.data;
    assertValidRequest(data);

    const result = planMinCost(data);
    const msg: PlannerWorkerResponse = { ok: true, result };
    ctx.postMessage(msg);
  } catch (e) {
    const msg: PlannerWorkerResponse = { ok: false, error: normalizeError(e) };
    ctx.postMessage(msg);
  }
});

// 這兩個不是必要，但在 Netlify / production 出問題時很好抓
ctx.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
  const msg: PlannerWorkerResponse = {
    ok: false,
    error: normalizeError(ev.reason),
  };
  ctx.postMessage(msg);
});

ctx.addEventListener("error", (ev: ErrorEvent) => {
  const msg: PlannerWorkerResponse = {
    ok: false,
    error: normalizeError(ev.error ?? ev.message),
  };
  ctx.postMessage(msg);
});

// 讓 TS 把這個檔案視為 module（避免某些設定下的全域衝突）
export {};
```

vite.config.ts
```
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
});
```
