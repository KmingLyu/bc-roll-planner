// src/domain/simulator.ts
import type { TrackGraph, PositionNode, Edge, Cat } from "@/types/models";
import { parsePosId, type Cursor, makeCursor } from "@/features/planner/logic/cursor";
import {
  getStepUpGuaranteedAt,
  isStepUpPool,
} from "@/features/track-graph/step-up";

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
// helpers
// -------------------------
function catPayload(cat?: Cat | null): {
  id: number | null;
  name: string;
  desc: string;
} {
  if (!cat) return { id: null, name: "-", desc: "" };
  return { id: cat.id, name: cat.name, desc: cat.desc || "" };
}

/**
 * 規則:
 * - 先看 normal edge 抽到的貓
 * - if: 跟上一抽 cat_id 相同，且 graph 已經提供 switch_track edge
 *   就走 switch_track
 * - else: 走 normal
 */
export function chooseEdgeForSingleDraw(
  node: PositionNode,
  prevCatId: number | null
): { edge: Edge; used: "normal" | "switch_track" } {
  const normal = node.edges?.normal;
  if (!normal)
    throw new SimulationError(`位置 ${node.id} 缺少 normal edge, 無法單抽`);

  const normalCatId = normal.cat?.id ?? null;
  const sw = node.edges?.switch_track;

  const shouldSwitch =
    !!sw &&
    prevCatId !== null &&
    normalCatId !== null &&
    normalCatId === prevCatId;

  if (shouldSwitch && sw) {
    return { edge: sw, used: "switch_track" };
  }
  return { edge: normal, used: "normal" };
}

// -------------------------
// v1: 單一 graph 模擬
// -------------------------
export function simulateOnGraph(params: {
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

  function runSingleDraw(
    eventValue: string,
    method: Method,
    currentCursor: Cursor,
    currentPrevCatId: number | null,
    withinActionIndex: number
  ): {
    nextCursor: Cursor;
    nextPrevCatId: number | null;
  } {
    const node = graph.nodes?.[currentCursor.id];
    if (!node) {
      throw new SimulationError(
        `[${eventValue}] graph.nodes 找不到位置 ${currentCursor.id}(count 不夠或資料缺漏)`
      );
    }

    const { edge, used } = chooseEdgeForSingleDraw(node, currentPrevCatId);
    step += 1;

    const p = catPayload(edge.cat);
    out.push({
      step,
      event_value: eventValue,
      method,
      within_action_index: withinActionIndex,
      from_pos_id: currentCursor.id,
      used,
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      to_pos_id: edge.to,
      source_pick_id: edge.source_pick_id ?? null,
      note: edge.note || "",
    });

    return {
      nextCursor: parsePosId(edge.to),
      nextPrevCatId: p.id,
    };
  }

  function advanceAgCursorWithMethod(eventValue: string, method: Method) {
    if (stepUpPhase === "none") return;
    if (!stepUpAgCursor) {
      throw new SimulationError(
        `[${eventValue}] step-up AG cursor 缺失，無法推進好康轉蛋鏈`
      );
    }

    if (
      method !== "single" &&
      method !== "ten" &&
      method !== "step_up_3" &&
      method !== "step_up_5" &&
      method !== "step_up_7"
    ) {
      return;
    }

    if (isStepUpMethod(method)) return;

    if (method === "single") {
      const node = graph.nodes?.[stepUpAgCursor.id];
      if (!node) {
        throw new SimulationError(
          `[${eventValue}] graph.nodes 找不到 AG 位置 ${stepUpAgCursor.id}(count 不夠或資料缺漏)`
        );
      }
      const { edge } = chooseEdgeForSingleDraw(node, stepUpAgPrevCatId);
      stepUpAgCursor = parsePosId(edge.to);
      stepUpAgPrevCatId = edge.cat?.id ?? null;
      return;
    }

    const startCursor = stepUpAgCursor;
    const startNode = graph.nodes?.[startCursor.id];
    if (!startNode) {
      throw new SimulationError(
        `[${eventValue}] graph.nodes 找不到 AG 起點 ${startCursor.id}, 無法重播 10連`
      );
    }

    const gEdge = startNode.edges?.guaranteed;
    for (let i = 0; i < 10; i += 1) {
      const node = graph.nodes?.[stepUpAgCursor.id];
      if (!node) {
        throw new SimulationError(
          `[${eventValue}] graph.nodes 找不到 AG 位置 ${stepUpAgCursor.id}(count 不夠或資料缺漏)`
        );
      }
      const { edge } = chooseEdgeForSingleDraw(node, stepUpAgPrevCatId);
      stepUpAgCursor = parsePosId(edge.to);
      stepUpAgPrevCatId = edge.cat?.id ?? null;
    }

    if (gEdge?.cat) {
      const finalTo = String(gEdge.to || "").trim();
      if (finalTo) {
        stepUpAgCursor = parsePosId(finalTo);
      } else {
        stepUpAgCursor = makeCursor(
          stepUpAgCursor.pos + 1,
          stepUpAgCursor.track === "A" ? "B" : "A"
        );
      }
      stepUpAgPrevCatId = gEdge.cat.id;
      return;
    }

    const node = graph.nodes?.[stepUpAgCursor.id];
    if (!node) {
      throw new SimulationError(
        `[${eventValue}] graph.nodes 找不到 AG 位置 ${stepUpAgCursor.id}(count 不夠或資料缺漏)`
      );
    }
    const { edge } = chooseEdgeForSingleDraw(node, stepUpAgPrevCatId);
    stepUpAgCursor = parsePosId(edge.to);
    stepUpAgPrevCatId = edge.cat?.id ?? null;
  }

  for (const act of actions) {
    const method = act.method;
    // 單抽
    if (method === "single") {
      const next = runSingleDraw(
        act.event_value,
        method,
        cursor,
        prevCatId,
        1
      );
      cursor = next.nextCursor;
      prevCatId = next.nextPrevCatId;
      advanceAgCursorWithMethod(act.event_value, method);
      continue;
    }

    // 10連抽
    if (method === "ten") {
      const startCursor = cursor;
      const startNode = graph.nodes?.[startCursor.id];
      if (!startNode) {
        throw new SimulationError(
          `[${act.event_value}] graph.nodes 找不到起點 ${startCursor.id}, 無法做 10連抽`
        );
      }

      const gEdge = startNode.edges?.guaranteed;

      // (1) 先做 10 抽：依單抽規則逐次走位
      for (let i = 1; i <= 10; i++) {
        const next = runSingleDraw(
          act.event_value,
          method,
          cursor,
          prevCatId,
          i
        );
        cursor = next.nextCursor;
        prevCatId = next.nextPrevCatId;
      }

      // (2) 第 11 抽：
      // - guaranteed pool: 走保底 bonus，並依 guaranteed edge 落點
      // - 一般 pool: 再做一次單抽規則，不額外強制換線
      if (gEdge?.cat) {
        step += 1;
        const p = catPayload(gEdge.cat);

        out.push({
          step,
          event_value: act.event_value,
          method,
          within_action_index: 11,
          from_pos_id: startCursor.id, // 來源: 起點的 G 欄(例如 1AG)
          used: "guaranteed",
          cat_id: p.id,
          cat_name: p.name,
          cat_desc: p.desc,
          to_pos_id: gEdge.to,
          source_pick_id: gEdge.source_pick_id ?? null,
          note: gEdge.note || "guaranteed bonus",
        });

        const finalTo = String(gEdge.to || "").trim();
        if (finalTo) {
          cursor = parsePosId(finalTo);
        } else {
          // fallback: +1 並換線（理論上不該發生，你的 function 幾乎都有 to）
          cursor = makeCursor(cursor.pos + 1, cursor.track === "A" ? "B" : "A");
        }

        prevCatId = p.id;
      } else {
        const next = runSingleDraw(
          act.event_value,
          method,
          cursor,
          prevCatId,
          11
        );
        cursor = next.nextCursor;
        prevCatId = next.nextPrevCatId;
      }

      advanceAgCursorWithMethod(act.event_value, method);
      continue;
    }

    if (isStepUpMethod(method)) {
      if (!isStepUpPool(graph)) {
        throw new SimulationError(
          `[${act.event_value}] ${method} 只能用在好康轉蛋池`
        );
      }

      if (method === "step_up_3" && stepUpPhase !== "none") {
        throw new SimulationError(
          `[${act.event_value}] 好康轉蛋 3 抽只能在新鏈開始時使用`
        );
      }
      if (method === "step_up_5" && stepUpPhase !== "after_3") {
        throw new SimulationError(
          `[${act.event_value}] 好康轉蛋 5 抽必須接在 3 抽之後`
        );
      }
      if (method === "step_up_7" && stepUpPhase !== "after_5") {
        throw new SimulationError(
          `[${act.event_value}] 好康轉蛋 7 抽必須接在 5 抽之後`
        );
      }

      if (method === "step_up_3") {
        stepUpAgCursor = makeCursor(cursor.pos, cursor.track);
        stepUpAgPrevCatId = prevCatId;
      }

      const singleDrawCount = stepUpSinglesBeforeGuaranteed(method);
      for (let i = 1; i <= singleDrawCount; i += 1) {
        const next = runSingleDraw(
          act.event_value,
          method,
          cursor,
          prevCatId,
          i
        );
        cursor = next.nextCursor;
        prevCatId = next.nextPrevCatId;
      }

      if (method === "step_up_7") {
        if (!stepUpAgCursor) {
          throw new SimulationError(
            `[${act.event_value}] 好康轉蛋 AG cursor 缺失，無法完成 7 抽保底`
          );
        }

        const guaranteed = getStepUpGuaranteedAt(graph, stepUpAgCursor.id);
        if (!guaranteed) {
          throw new SimulationError(
            `[${act.event_value}] ${stepUpAgCursor.id} 沒有可用的好康轉蛋 AG 保底`
          );
        }

        step += 1;
        const p = catPayload(guaranteed.cat);
        out.push({
          step,
          event_value: act.event_value,
          method,
          within_action_index: 7,
          from_pos_id: guaranteed.cursor_id,
          used: "guaranteed",
          cat_id: p.id,
          cat_name: p.name,
          cat_desc: p.desc,
          to_pos_id: guaranteed.to_pos_id,
          source_pick_id: guaranteed.source_pick_id,
          note: "step-up guaranteed bonus",
        });

        cursor = parsePosId(guaranteed.to_pos_id);
        prevCatId = p.id;
        stepUpPhase = "none";
        stepUpAgCursor = null;
        stepUpAgPrevCatId = null;
      } else {
        stepUpPhase = method === "step_up_3" ? "after_3" : "after_5";
      }

      continue;
    }

    throw new SimulationError(
      `不支援的 method=${formatUnknownMethod(method)}`
    );
  }

  return { records: out, final_cursor: cursor };
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
