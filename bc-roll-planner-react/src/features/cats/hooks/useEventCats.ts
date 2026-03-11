// src/features/cats/model/useEventCats.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@/types/models";
import { fetchEventCats } from "@/features/cats/api/getEventCats";
import { ApiError } from "@/lib/api-client";
import type { CatTier, TierGroup, UiCat } from "@/features/cats/types";

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
              raw_name: meta?.raw_name ?? meta?.name ?? ev,
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
