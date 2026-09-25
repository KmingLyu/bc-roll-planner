// src/domain/simulator.ts
import type { TrackGraph } from "@/types/models";
import { parsePosId, type Cursor } from "@/features/planner/logic/cursor";
import { isStepUpPool } from "@/features/track-graph/step-up";
import { rollSingle, rollTen, rollSingles, rollStepUpSeven, advanceAgCursor, RollRuleError, type RollDraw } from "@/features/roll-rules/rollRules";
export { chooseEdgeForSingleDraw } from "@/features/roll-rules/rollRules";

// -------------------------
// 使用者輸入動作格式
// - single: 1抽
// - ten: 罐頭 10 連抽，固定做 11 抽
//   - 有 guaranteed edge: 第 11 抽走保底規則
//   - 否則: 第 11 抽沿用一般單抽規則
// - step_up_3 / step_up_5 / step_up_7: 好康轉蛋 3 / 5 / 7
// -------------------------
export type Method =
  | "single"
  | "ten"
  | "step_up_3"
  | "step_up_5"
  | "step_up_7";

type StepUpPhase = "none" | "after_3" | "after_5";

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

function formatUnknownMethod(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function isStepUpMethod(method: Method): boolean {
  return (
    method === "step_up_3" ||
    method === "step_up_5" ||
    method === "step_up_7"
  );
}

function stepUpSinglesBeforeGuaranteed(method: Method): number {
  if (method === "step_up_3") return 3;
  if (method === "step_up_5") return 5;
  if (method === "step_up_7") return 6;
  return 0;
}

// -------------------------
// v1: 單一 graph 模擬
// -------------------------
function simulateOnGraphWithSharedRules(params: {
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
  }

  let cursor = parsePosId(startPosId);
  let prevCatId: number | null = null;
  let stepUpPhase: StepUpPhase = "none";
  let stepUpAgCursor: Cursor | null = null;
  let stepUpAgPrevCatId: number | null = null;
  const out: DrawRecord[] = [];
  let step = 0;

  function pushDraws(method: Method, draws: RollDraw[]) {
    for (const [index, draw] of draws.entries()) {
      step += 1;
      out.push({
        step,
        event_value: graph.event.value,
        method,
        within_action_index: index + 1,
        ...draw,
      });
    }
  }

  function advanceAgCursorWithMethod(method: "single" | "ten") {
    if (stepUpPhase === "none") return;
    if (!stepUpAgCursor) {
      throw new SimulationError(`[${graph.event.value}] step-up AG cursor 缺失，無法推進好康轉蛋鏈`);
    }
    const next = advanceAgCursor({
      graph,
      method,
      cursor_id: stepUpAgCursor.id,
      prev_cat_id: stepUpAgPrevCatId,
      missing_guaranteed_to: "switch",
    });
    stepUpAgCursor = parsePosId(next.next_cursor_id);
    stepUpAgPrevCatId = next.next_prev;
  }

  for (const act of actions) {
    const method = act.method;
    if (method === "single") {
      const next = rollSingle({ graph, cursor_id: cursor.id, prev_cat_id: prevCatId });
      pushDraws(method, [next.hit]);
      cursor = parsePosId(next.next_cursor_id);
      prevCatId = next.next_prev;
      advanceAgCursorWithMethod(method);
      continue;
    }
    if (method === "ten") {
      const next = rollTen({ graph, cursor_id: cursor.id, prev_cat_id: prevCatId, missing_guaranteed_to: "switch" });
      pushDraws(method, next.draws);
      cursor = parsePosId(next.end_cursor_id);
      prevCatId = next.end_prev;
      advanceAgCursorWithMethod(method);
      continue;
    }

    if (isStepUpMethod(method)) {
      if (!isStepUpPool(graph)) {
        throw new SimulationError(`[${act.event_value}] ${method} 只能用在好康轉蛋池`);
      }
      if (method === "step_up_3" && stepUpPhase !== "none") {
        throw new SimulationError(`[${act.event_value}] 好康轉蛋 3 抽只能在新鏈開始時使用`);
      }
      if (method === "step_up_5" && stepUpPhase !== "after_3") {
        throw new SimulationError(`[${act.event_value}] 好康轉蛋 5 抽必須接在 3 抽之後`);
      }
      if (method === "step_up_7" && stepUpPhase !== "after_5") {
        throw new SimulationError(`[${act.event_value}] 好康轉蛋 7 抽必須接在 5 抽之後`);
      }
      if (method === "step_up_3") {
        stepUpAgCursor = parsePosId(cursor.id);
        stepUpAgPrevCatId = prevCatId;
      }
      if (method === "step_up_7" && !stepUpAgCursor) {
        throw new SimulationError(`[${act.event_value}] 好康轉蛋 AG cursor 缺失，無法完成 7 抽保底`);
      }
      const next = method === "step_up_7"
        ? rollStepUpSeven({
            graph, cursor_id: cursor.id, prev_cat_id: prevCatId,
            ag_cursor_id: stepUpAgCursor?.id ?? "",
          })
        : rollSingles({
            graph, cursor_id: cursor.id, prev_cat_id: prevCatId,
            draw_count: stepUpSinglesBeforeGuaranteed(method),
          });
      pushDraws(method, next.draws);
      cursor = parsePosId(next.end_cursor_id);
      prevCatId = next.end_prev;
      if (method === "step_up_7") {
        stepUpPhase = "none";
        stepUpAgCursor = null;
        stepUpAgPrevCatId = null;
      } else {
        stepUpPhase = method === "step_up_3" ? "after_3" : "after_5";
      }
      continue;
    }
    throw new SimulationError(`不支援的 method=${formatUnknownMethod(method)}`);
  }

  return { records: out, final_cursor: cursor };
}

export function simulateOnGraph(params: {
  graph: TrackGraph;
  actions: SimAction[];
  start_pos_id?: string;
}): { records: DrawRecord[]; final_cursor: Cursor } {
  try {
    return simulateOnGraphWithSharedRules(params);
  } catch (error) {
    if (error instanceof RollRuleError) throw new SimulationError(error.message);
    throw error;
  }
}

// -------------------------
// Convenience helpers（對齊 Python 的 estimate_required_counts/parse_actions）
// -------------------------
export function parseActions(raw: unknown): SimAction[] {
  if (!Array.isArray(raw)) throw new SimulationError("actions 必須是 array");
  const out: SimAction[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      throw new SimulationError(`actions[${i + 1}] 必須是 object`);
    }
    const record = item as Record<string, unknown>;
    const ev = String(record.event_value || "").trim();
    if (!ev) throw new SimulationError(`actions[${i + 1}] 缺少 event_value`);
    const method = record.method;
    if (
      method !== "single" &&
      method !== "ten" &&
      method !== "step_up_3" &&
      method !== "step_up_5" &&
      method !== "step_up_7"
    ) {
      throw new SimulationError(
        `actions[${i + 1}].method 必須是 'single'、'ten'、'step_up_3'、'step_up_5' 或 'step_up_7', 但得到 ${formatUnknownMethod(method)}`
      );
    }
    out.push({ event_value: ev, method });
  }
  return out;
}

/**
 * v1 估算：single=1, ten=13（對 10 連額外保留安全餘量）
 * +20 buffer
 */
export function estimateRequiredCounts(actions: SimAction[]): number {
  let count = 0;
  for (const a of actions) {
    if (a.method === "single") count += 1;
    else if (a.method === "ten") count += 13;
    else if (a.method === "step_up_3") count += 3;
    else if (a.method === "step_up_5") count += 5;
    else if (a.method === "step_up_7") count += 7;
  }
  return count + 20;
}
