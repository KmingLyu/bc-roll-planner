// src/shared/api/trackGraphApi.ts
import { netlifyGet } from "@/lib/api-client";
import type { TrackGraph, PoolType } from "@/types/models";

export type TrackGraphResponse = {
  graph: TrackGraph;
};

export async function fetchTrackGraph(params: {
  seed: string;
  event: string;
  count: number;
  signal?: AbortSignal;
  lang?: string;
  ui?: string;
  base_url?: string;

  // 這些只是寫進 graph.event 方便顯示
  name?: string;
  raw_name?: string;
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
    raw_name: params.raw_name,
    start_date: params.start_date ?? undefined,
    end_date: params.end_date ?? undefined,
    pool_type: params.pool_type,
  }, {
    signal: params.signal,
  });
}
