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

self.onmessage = (ev: MessageEvent<PlannerWorkerRequest>) => {
  try {
    const result = planMinCost(ev.data);
    const msg: PlannerWorkerResponse = { ok: true, result };
    (self as any).postMessage(msg);
  } catch (e: any) {
    const msg: PlannerWorkerResponse = {
      ok: false,
      error: String(e?.message || e),
    };
    (self as any).postMessage(msg);
  }
};
