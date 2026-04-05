/// <reference lib="webworker" />

// src/features/planner/worker/planner.worker.ts
import type { TrackGraph, Cat } from "@/types/models";
import type { EventMeta, PlannerConfig, PlanResult } from "@/features/planner/logic/core";
import { planMinCost } from "@/features/planner/logic/core";

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

const ctx = self as DedicatedWorkerGlobalScope;

function normalizeError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;

  // 常見：Error
  const maybeError = e as { message?: unknown; stack?: unknown };
  const msg = maybeError.message ? String(maybeError.message) : String(e);

  // 盡量把 stack 留下（方便你在 devtools 看）
  const stack = maybeError.stack ? String(maybeError.stack) : "";
  return stack ? `${msg}\n${stack}` : msg;
}

function assertValidRequest(d: unknown): asserts d is PlannerWorkerRequest {
  if (!d || typeof d !== "object")
    throw new Error("PlannerWorkerRequest is empty");

  const request = d as Partial<PlannerWorkerRequest>;

  if (!request.graphs_by_event || typeof request.graphs_by_event !== "object") {
    throw new Error("PlannerWorkerRequest.graphs_by_event is missing");
  }
  if (!Array.isArray(request.events)) {
    throw new Error("PlannerWorkerRequest.events is missing");
  }
  if (!Array.isArray(request.target_cats)) {
    throw new Error("PlannerWorkerRequest.target_cats is missing");
  }

  // resources：至少要是 number（允許 0）
  for (const k of [
    "tickets",
    "platinum_tickets",
    "legend_tickets",
    "food",
  ] as const) {
    if (typeof request[k] !== "number" || Number.isNaN(request[k])) {
      throw new Error(`PlannerWorkerRequest.${k} must be a number`);
    }
  }
}

ctx.addEventListener("message", (ev: MessageEvent<PlannerWorkerRequest>) => {
  try {
    const data = ev.data;
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
