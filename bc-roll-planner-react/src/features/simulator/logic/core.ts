// src/domain/simulator.ts
import type { TrackGraph, PositionNode, Edge, Cat } from "@/types/models";
import { parsePosId, type Cursor, makeCursor } from "@/utils/cursor";

// -------------------------
// 使用者輸入動作格式
// - single: 1抽
// - ten: 10連抽(是否有保底, 看起點是否有 guaranteed edge)
// -------------------------
export type Method = "single" | "ten";

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
 * - if: 跟上一抽 cat_id 相同, 且有 switch_track edge, 且 rarity == "rare"
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
    node.rarity === "rare" &&
    !!sw &&
    prevCatId !== null &&
    normalCatId !== null &&
    normalCatId === prevCatId;

  // console.log({ edge: normal, used: "normal" });

  if (shouldSwitch && sw) {
    // console.log({ edge: sw, used: "switch_track" });
    return { edge: sw, used: "switch_track" };
  }
  // console.log({
  //   nodeId: node.id,
  //   prevCatId,
  //   normalCatId,
  //   shouldSwitch,
  // });
  // 把edge印出來
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
    if (a.method !== "single" && a.method !== "ten") {
      throw new SimulationError(`未支援 method=${String((a as any).method)}`);
    }
  }

  let cursor = parsePosId(startPosId);
  let prevCatId: number | null = null;
  const out: DrawRecord[] = [];
  let step = 0;

  for (const act of actions) {
    const method = act.method;
    // console.log(`--- Action: ${act.event_value} / ${method} ---`);

    // 單抽
    if (method === "single") {
      const node = graph.nodes?.[cursor.id];
      if (!node) {
        throw new SimulationError(
          `[${act.event_value}] graph.nodes 找不到位置 ${cursor.id}(count 不夠或資料缺漏)`
        );
      }

      const { edge, used } = chooseEdgeForSingleDraw(node, prevCatId);
      // console.log(used);
      step += 1;

      const p = catPayload(edge.cat);
      out.push({
        step,
        event_value: act.event_value,
        method,
        within_action_index: 1,
        from_pos_id: cursor.id,
        used,
        cat_id: p.id,
        cat_name: p.name,
        cat_desc: p.desc,
        to_pos_id: edge.to,
        source_pick_id: edge.source_pick_id ?? null,
        note: edge.note || "",
      });

      cursor = parsePosId(edge.to);
      prevCatId = p.id;
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
      const hasGuaranteed = !!(gEdge && gEdge.cat);

      // (1) 先做 10 抽：依單抽規則逐次走位
      for (let i = 1; i <= 10; i++) {
        const node = graph.nodes?.[cursor.id];
        if (!node) {
          throw new SimulationError(
            `[${act.event_value}] graph.nodes 找不到位置 ${cursor.id}(count 不夠或資料缺漏)`
          );
        }

        const { edge, used } = chooseEdgeForSingleDraw(node, prevCatId);
        step += 1;

        const p = catPayload(edge.cat);
        out.push({
          step,
          event_value: act.event_value,
          method,
          within_action_index: i,
          from_pos_id: cursor.id,
          used,
          cat_id: p.id,
          cat_name: p.name,
          cat_desc: p.desc,
          to_pos_id: edge.to,
          source_pick_id: edge.source_pick_id ?? null,
          note: edge.note || "",
        });

        cursor = parsePosId(edge.to);
        prevCatId = p.id;
      }

      // (2) 若起點有 guaranteed，才追加第 11 抽(保底)
      if (hasGuaranteed && gEdge) {
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
          to_pos_id: "-",
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
      }

      continue;
    }
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
    const item = raw[i] as any;
    if (!item || typeof item !== "object") {
      throw new SimulationError(`actions[${i + 1}] 必須是 object`);
    }
    const ev = String(item.event_value || "").trim();
    if (!ev) throw new SimulationError(`actions[${i + 1}] 缺少 event_value`);
    const method = item.method;
    if (method !== "single" && method !== "ten") {
      throw new SimulationError(
        `actions[${i + 1}].method 必須是 'single' 或 'ten', 但得到 ${String(
          method
        )}`
      );
    }
    out.push({ event_value: ev, method });
  }
  return out;
}

/**
 * v1 估算：single=1, ten=10（不算保底第11隻）
 * +20 buffer
 */
export function estimateRequiredCounts(actions: SimAction[]): number {
  let count = 0;
  for (const a of actions) {
    if (a.method === "single") count += 1;
    else if (a.method === "ten") count += 10;
    else
      throw new SimulationError(
        `未支援 method=${String((a as any).method)} 的估算`
      );
  }
  return count + 20;
}
