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
