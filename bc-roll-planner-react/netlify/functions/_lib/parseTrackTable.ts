import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element as DomElement } from "domhandler";

import { normalizeText } from "./normalize";
import type { Cat, PickCell } from "./buildGraph";

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
