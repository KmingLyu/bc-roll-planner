import type { Cat, Edge, PositionNode, TrackGraph } from "@/types/models";
import { makeCursor, parsePosId } from "@/features/planner/logic/cursor";
import { getStepUpGuaranteedAt } from "@/features/track-graph/step-up";

export type RollDraw = {
  cat_id: number | null;
  cat_name: string;
  cat_desc: string;
  used: "normal" | "switch_track" | "guaranteed";
  from_pos_id: string;
  to_pos_id: string;
  source_pick_id?: string | null;
  note?: string;
};

export class RollRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollRuleError";
  }
}

function catPayload(cat?: Cat | null) {
  return cat
    ? { id: cat.id, name: cat.name, desc: cat.desc || "" }
    : { id: null, name: "-", desc: "" };
}

export function chooseEdgeForSingleDraw(
  node: PositionNode,
  prevCatId: number | null,
): { edge: Edge; used: "normal" | "switch_track" } {
  const normal = node.edges?.normal;
  if (!normal) {
    throw new RollRuleError(`位置 ${node.id} 缺少 normal edge, 無法單抽`);
  }
  const normalCatId = normal.cat?.id ?? null;
  const sw = node.edges?.switch_track;
  if (sw && prevCatId !== null && normalCatId !== null && normalCatId === prevCatId) {
    return { edge: sw, used: "switch_track" };
  }
  return { edge: normal, used: "normal" };
}

export function rollSingle(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
}): { next_cursor_id: string; next_prev: number | null; hit: RollDraw } {
  const { graph, cursor_id, prev_cat_id } = params;
  const node = graph.nodes?.[cursor_id];
  if (!node) {
    throw new RollRuleError(`[${graph.event.value}] 找不到位置 ${cursor_id}（count 不夠或資料缺漏）`);
  }
  const { edge, used } = chooseEdgeForSingleDraw(node, prev_cat_id);
  const p = catPayload(edge.cat);
  return {
    next_cursor_id: parsePosId(edge.to).id,
    next_prev: p.id,
    hit: {
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used,
      from_pos_id: cursor_id,
      to_pos_id: edge.to,
      source_pick_id: edge.source_pick_id ?? null,
      note: edge.note || "",
    },
  };
}

export function rollSingles(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
  draw_count: number;
}): { end_cursor_id: string; end_prev: number | null; draws: RollDraw[] } {
  const draws: RollDraw[] = [];
  let cur = params.cursor_id;
  let prev = params.prev_cat_id;
  for (let i = 0; i < params.draw_count; i += 1) {
    const single = rollSingle({ graph: params.graph, cursor_id: cur, prev_cat_id: prev });
    draws.push(single.hit);
    cur = single.next_cursor_id;
    prev = single.next_prev;
  }
  return { end_cursor_id: cur, end_prev: prev, draws };
}

export function rollTen(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
  missing_guaranteed_to?: "error" | "switch";
}): { end_cursor_id: string; end_prev: number | null; draws: RollDraw[] } {
  const { graph, cursor_id } = params;
  const startNode = graph.nodes?.[cursor_id];
  if (!startNode) {
    throw new RollRuleError(`[${graph.event.value}] 找不到十連起點 ${cursor_id}`);
  }
  const gEdge = startNode.edges.guaranteed;
  const firstTen = rollSingles({ ...params, draw_count: 10 });
  const draws = [...firstTen.draws];
  let cur = firstTen.end_cursor_id;
  let prev = firstTen.end_prev;

  if (gEdge?.cat) {
    const p = catPayload(gEdge.cat);
    const finalTo = String(gEdge.to || "").trim();
    if (!finalTo && params.missing_guaranteed_to !== "switch") {
      throw new RollRuleError(`[${graph.event.value}] guaranteed edge 沒有 to，無法結算十連落點`);
    }
    draws.push({
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used: "guaranteed",
      from_pos_id: cursor_id,
      to_pos_id: gEdge.to,
      source_pick_id: gEdge.source_pick_id ?? null,
      note: gEdge.note || "guaranteed bonus",
    });
    cur = finalTo
      ? parsePosId(finalTo).id
      : makeCursor(parsePosId(cur).pos + 1, parsePosId(cur).track === "A" ? "B" : "A").id;
    prev = p.id;
  } else {
    const lastSingle = rollSingle({ graph, cursor_id: cur, prev_cat_id: prev });
    draws.push(lastSingle.hit);
    cur = lastSingle.next_cursor_id;
    prev = lastSingle.next_prev;
  }
  return { end_cursor_id: cur, end_prev: prev, draws };
}

export function rollStepUpSeven(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
  ag_cursor_id: string;
}): { end_cursor_id: string; end_prev: number | null; draws: RollDraw[] } {
  const firstSix = rollSingles({ ...params, draw_count: 6 });
  const guaranteed = getStepUpGuaranteedAt(params.graph, params.ag_cursor_id);
  if (!guaranteed) {
    throw new RollRuleError(`[${params.graph.event.value}] ${params.ag_cursor_id} 沒有可用的好康轉蛋 AG 保底`);
  }
  const p = catPayload(guaranteed.cat);
  return {
    end_cursor_id: parsePosId(guaranteed.to_pos_id).id,
    end_prev: p.id,
    draws: [...firstSix.draws, {
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used: "guaranteed",
      from_pos_id: guaranteed.cursor_id,
      to_pos_id: guaranteed.to_pos_id,
      source_pick_id: guaranteed.source_pick_id,
      note: "step-up guaranteed bonus",
    }],
  };
}

export function advanceAgCursor(params: {
  graph: TrackGraph;
  method: "single" | "ten";
  cursor_id: string;
  prev_cat_id: number | null;
  missing_guaranteed_to?: "error" | "switch";
}): { next_cursor_id: string; next_prev: number | null } {
  if (params.method === "single") {
    const next = rollSingle(params);
    return { next_cursor_id: next.next_cursor_id, next_prev: next.next_prev };
  }
  const next = rollTen(params);
  return { next_cursor_id: next.end_cursor_id, next_prev: next.end_prev };
}
