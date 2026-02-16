// src/shared/api/eventCatsApi.ts
import { netlifyGet } from "@/lib/api-client";
import type { Event, Cat, CatTier, PoolType } from "@/types/models";

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
