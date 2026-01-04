import { netlifyGet } from "./netlifyClient";
import type { Event, Cat, CatTier } from "../../shared/models";

export type TierGroup = { tier: CatTier; cats: Cat[] };

export type EventCatsResponse = {
  event: Event;
  source: "find_select" | "last_select" | "none";
  count: number;
  groups: TierGroup[];
  cats: Cat[];
};

export async function fetchEventCats(params: {
  seed: string;
  event: string;
  count: number;
  lang?: string;
  ui?: string;
  base_url?: string;

  name?: string;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<EventCatsResponse> {
  return netlifyGet<EventCatsResponse>("eventCats", {
    seed: params.seed,
    event: params.event,
    count: params.count,
    lang: params.lang ?? "tw",
    ui: params.ui ?? "tw",
    base_url: params.base_url,

    name: params.name,
    start_date: params.start_date ?? undefined,
    end_date: params.end_date ?? undefined,
  });
}
