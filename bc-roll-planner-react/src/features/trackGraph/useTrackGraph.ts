import type { TrackGraph, Event } from "../../../shared/models";
import { fetchTrackGraph } from "../../api/trackGraphApi";
import { ApiError } from "../../api/netlifyClient";

export type TrackGraphFetchParams = {
  seed: string;
  count: number;
  event: Event;
};

export async function fetchGraphOrThrow({
  seed,
  count,
  event,
}: TrackGraphFetchParams): Promise<TrackGraph> {
  try {
    const res = await fetchTrackGraph({
      seed: seed.trim(),
      event: event.value,
      count: Number(count),
      lang: "tw",
      ui: "tw",
      name: event.name ?? event.value,
      start_date: event.start_date ?? null,
      end_date: event.end_date ?? null,
    });
    return res.graph as TrackGraph;
  } catch (e: any) {
    if (e instanceof ApiError) {
      throw new Error(`${e.message} (HTTP ${e.status})`);
    }
    throw new Error(String(e?.message || e));
  }
}
