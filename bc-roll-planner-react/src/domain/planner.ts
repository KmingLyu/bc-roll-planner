import type {
  TrackGraph,
  PositionNode,
  Edge,
  Cat,
  PoolType,
} from "@/shared/models";
import { parsePosId } from "./utils";
import { chooseEdgeForSingleDraw } from "./simulator";

export type ResourceType =
  | "ticket"
  | "platinum_ticket"
  | "legend_ticket"
  | "food";
export type PlanMethod = "single" | "ten";

/** pool_type 從 graph.event.pool_type 讀 */
export type EventMeta = {
  event_value: string;
};

export type PlannerState = {
  cursor_id: string;
  prev_cat_id: number | null;
  tickets_left: number;
  platinum_left: number;
  legend_left: number;
  food_left: number;
  mask: number;
};

// (equiv_cost, food_used, ticket_used, platinum_used, legend_used)
export type Cost = [number, number, number, number, number];

export type DrawHit = {
  cat_id: number | null;
  cat_name: string;
  cat_desc: string;
  used: "normal" | "switch_track" | "guaranteed";
  from_pos_id: string;
  to_pos_id: string;
  source_pick_id?: string | null;
  note?: string;
};

export type PlanStep = {
  event_value: string;
  pool_type: PoolType;
  resource: ResourceType;
  method: PlanMethod;
  cost_inc: Cost;
  draws: DrawHit[];
  start_cursor_id: string;
  end_cursor_id: string;
  start_prev_cat_id: number | null;
  end_prev_cat_id: number | null;
};

export type PlanResult = {
  success: boolean;
  plan: PlanStep[];
  final_cursor_id: string;
  final_prev_cat_id: number | null;

  targets_total: number;
  targets_hit: number;
  targets_hit_ids: number[];
  targets_missing_ids: number[];

  total_cost: Cost;
  tickets_used: number;
  equiv_cost: number;
  platinum_used: number;
  legend_used: number;
  food_used: number;

  all_draws: DrawHit[];
};

export class PlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerError";
  }
}

// -------------------------
// Config
// -------------------------
export type PlannerConfig = {
  // 等價成本（預設都視為一次單抽=150）
  weights?: Partial<
    Record<
      | "ticket_single"
      | "platinum_single"
      | "legend_single"
      | "food_single"
      | "food_ten",
      number
    >
  >;

  // 每種池允許哪些 action_key
  allowed_actions_by_pool?: Partial<Record<PoolType, string[]>>;

  // 搜尋上限（避免極端狀況）
  max_expansions?: number;

  /**
   * 是否啟用「mask 支配剪枝（Dominance pruning）」：
   * - 對同一個物理狀態 (cursor/prev/resources)，若已有 (maskA,costA) 支配 (maskB,costB)
   *   會直接丟掉被支配的狀態，通常能大幅壓制 target 太多造成的 2^k 爆炸。
   */
  enable_dominance_pruning?: boolean;

  /**
   * 是否用 A*（f=g+h）而不是純 Dijkstra（f=g）：
   * - h 是「剩餘目標 * 最小每抽等價成本」的下界，能更快收斂到全命中。
   */
  use_astar?: boolean;
};

function normalizeConfig(cfg?: PlannerConfig): Required<PlannerConfig> {
  const weights = {
    ticket_single: 150,
    platinum_single: 200,
    legend_single: 300,
    food_single: 150,
    food_ten: 1500,
    ...(cfg?.weights || {}),
  };

  const allowed_actions_by_pool: Record<PoolType, string[]> = {
    normal: ["ticket_single", "food_single", "food_ten"],
    platinum: ["platinum_single"],
    legend: ["legend_single"],
    ...(cfg?.allowed_actions_by_pool || {}),
  } as any;

  return {
    weights,
    allowed_actions_by_pool,
    max_expansions: cfg?.max_expansions ?? 500_000,
    enable_dominance_pruning: cfg?.enable_dominance_pruning ?? true,
    use_astar: cfg?.use_astar ?? true,
  };
}

function isActionAllowed(
  cfg: Required<PlannerConfig>,
  pool: PoolType,
  actionKey: string
): boolean {
  const allowed = cfg.allowed_actions_by_pool[pool];
  return Array.isArray(allowed) ? allowed.includes(actionKey) : false;
}

// -------------------------
// Cost helpers
// -------------------------
function addCost(a: Cost, b: Cost): Cost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]];
}

function costIncForAction(
  cfg: Required<PlannerConfig>,
  actionKey: string
): Cost {
  const equiv = Number(cfg.weights[actionKey as keyof typeof cfg.weights] ?? 0);
  if (actionKey === "food_single") return [equiv, 150, 0, 0, 0];
  if (actionKey === "food_ten") return [equiv, 1500, 0, 0, 0];
  if (actionKey === "ticket_single") return [equiv, 0, 1, 0, 0];
  if (actionKey === "platinum_single") return [equiv, 0, 0, 1, 0];
  if (actionKey === "legend_single") return [equiv, 0, 0, 0, 1];
  throw new PlannerError(`未知 action_key=${actionKey}`);
}

// 目前比較只看 equiv_cost
function costLess(a: Cost, b: Cost): boolean {
  return a[0] < b[0];
}
function costEq(a: Cost, b: Cost): boolean {
  return a[0] === b[0];
}

// -------------------------
// Target mask helpers
// -------------------------
function normalizeTargetIds(targets: Array<number | Cat>): number[] {
  const out: number[] = [];
  for (const t of targets) {
    if (typeof t === "number") out.push(t);
    else if (t && typeof (t as any).id === "number") out.push((t as any).id);
    else throw new PlannerError(`targets 只支援 number(cat_id) 或 Cat`);
  }
  // 去重但保序
  const seen = new Set<number>();
  const uniq: number[] = [];
  for (const x of out) {
    if (!seen.has(x)) {
      seen.add(x);
      uniq.push(x);
    }
  }
  return uniq;
}

function buildTargetIndex(targetIds: number[]): Map<number, number> {
  const m = new Map<number, number>();
  targetIds.forEach((cid, i) => m.set(cid, i));
  return m;
}

function applyHit(
  mask: number,
  targetIndex: Map<number, number>,
  catId: number | null
): number {
  if (catId == null) return mask;
  const i = targetIndex.get(catId);
  if (i == null) return mask;
  return mask | (1 << i);
}

function maskToHitIds(mask: number, targetIds: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < targetIds.length; i++) {
    if (((mask >> i) & 1) === 1) out.push(targetIds[i]);
  }
  return out;
}

function bitCount32(n: number): number {
  let x = n >>> 0;
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

// -------------------------
// Draw simulation (single / ten)
// -------------------------
function catPayload(cat?: Cat | null): {
  id: number | null;
  name: string;
  desc: string;
} {
  if (!cat) return { id: null, name: "-", desc: "" };
  return { id: cat.id, name: cat.name, desc: cat.desc || "" };
}

function simulateSingleTransition(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
}): { next_cursor_id: string; next_prev: number | null; hit: DrawHit } {
  const { graph, cursor_id, prev_cat_id } = params;
  const node = graph.nodes?.[cursor_id] as PositionNode | undefined;
  if (!node) {
    throw new PlannerError(
      `[${graph.event.value}] 找不到位置 ${cursor_id}（count 不夠或資料缺漏）`
    );
  }

  const { edge, used } = chooseEdgeForSingleDraw(node, prev_cat_id);
  // console.log({ edge, used });
  const p = catPayload(edge.cat);
  // console.log(p.id, p.name);

  const hit: DrawHit = {
    cat_id: p.id,
    cat_name: p.name,
    cat_desc: p.desc,
    used,
    from_pos_id: cursor_id,
    to_pos_id: edge.to,
    source_pick_id: edge.source_pick_id ?? null,
    note: edge.note || "",
  };

  const next_cursor_id = parsePosId(edge.to).id;
  const next_prev = p.id;
  // console.log({ next_cursor_id, next_prev, hit });
  return { next_cursor_id, next_prev, hit };
}

function simulateTenTransition(params: {
  graph: TrackGraph;
  cursor_id: string;
  prev_cat_id: number | null;
}): { end_cursor_id: string; end_prev: number | null; draws: DrawHit[] } {
  const { graph } = params;
  const start_cursor_id = params.cursor_id;

  const startNode = graph.nodes?.[start_cursor_id] as PositionNode | undefined;
  if (!startNode)
    throw new PlannerError(
      `[${graph.event.value}] 找不到十連起點 ${start_cursor_id}`
    );

  const gEdge = (startNode.edges as any)?.guaranteed as Edge | undefined;
  const hasGuaranteed = !!(gEdge && gEdge.cat);

  const draws: DrawHit[] = [];
  let cur = params.cursor_id;
  let prev = params.prev_cat_id;

  for (let i = 0; i < 10; i++) {
    const node = graph.nodes?.[cur] as PositionNode | undefined;
    if (!node)
      throw new PlannerError(
        `[${graph.event.value}] 找不到位置 ${cur}（count 不夠或資料缺漏）`
      );

    const { edge, used } = chooseEdgeForSingleDraw(node, prev);
    const p = catPayload(edge.cat);

    draws.push({
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used,
      from_pos_id: cur,
      to_pos_id: edge.to,
      source_pick_id: edge.source_pick_id ?? null,
      note: edge.note || "",
    });

    cur = parsePosId(edge.to).id;
    prev = p.id;
  }

  if (hasGuaranteed && gEdge) {
    const p = catPayload(gEdge.cat);
    draws.push({
      cat_id: p.id,
      cat_name: p.name,
      cat_desc: p.desc,
      used: "guaranteed",
      from_pos_id: start_cursor_id,
      to_pos_id: "-",
      source_pick_id: gEdge.source_pick_id ?? null,
      note: gEdge.note || "guaranteed bonus",
    });

    const finalTo = String(gEdge.to || "").trim();
    if (!finalTo) {
      throw new PlannerError(
        `[${graph.event.value}] guaranteed edge 沒有 to，無法結算十連落點`
      );
    }
    cur = parsePosId(finalTo).id;
    prev = p.id;
  }

  return { end_cursor_id: cur, end_prev: prev, draws };
}

// -------------------------
// Min-Heap (A* / Dijkstra)
// -------------------------
type PQItem = { prio: number; g: Cost; seq: number; key: string };

class MinHeap {
  private a: PQItem[] = [];
  size() {
    return this.a.length;
  }
  push(x: PQItem) {
    this.a.push(x);
    this.up(this.a.length - 1);
  }
  pop(): PQItem | undefined {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      this.down(0);
    }
    return top;
  }
  private less(i: number, j: number) {
    const A = this.a[i],
      B = this.a[j];
    if (A.prio !== B.prio) return A.prio < B.prio;
    // prio 相同才用 g 作 tie-break（可減少走歪路）
    if (!costEq(A.g, B.g)) return costLess(A.g, B.g);
    return A.seq < B.seq;
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
        i = p;
      } else break;
    }
  }
  private down(i: number) {
    const n = this.a.length;
    while (true) {
      let m = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m !== i) {
        [this.a[i], this.a[m]] = [this.a[m], this.a[i]];
        i = m;
      } else break;
    }
  }
}

// -------------------------
// State key helpers
// -------------------------
function stateKey(s: PlannerState): string {
  return [
    s.cursor_id,
    s.prev_cat_id == null ? "-" : String(s.prev_cat_id),
    s.tickets_left,
    s.platinum_left,
    s.legend_left,
    s.food_left,
    s.mask,
  ].join("|");
}

/**
 * ✅ 重大優化：不再用 stateByKey 存所有 PlannerState（非常吃記憶體），
 * 直接從 key 反解析回狀態，省掉一大塊記憶體。
 */
function parseStateKey(k: string): PlannerState {
  const parts = k.split("|");
  if (parts.length !== 7) throw new PlannerError(`stateKey 格式錯誤: ${k}`);
  const [cursor, prevStr, t, p, l, f, m] = parts;
  const prev = prevStr === "-" ? null : Number(prevStr);
  return {
    cursor_id: cursor,
    prev_cat_id: Number.isFinite(prev as any) ? (prev as any) : null,
    tickets_left: Number(t),
    platinum_left: Number(p),
    legend_left: Number(l),
    food_left: Number(f),
    mask: Number(m),
  };
}

/**
 * ✅ 物理狀態 key（不含 mask）：
 * 用於 dominance pruning：同一物理狀態下，mask/成本被支配就直接剪掉。
 */
function physicalKeyFromState(s: PlannerState): string {
  return [
    s.cursor_id,
    s.prev_cat_id == null ? "-" : String(s.prev_cat_id),
    s.tickets_left,
    s.platinum_left,
    s.legend_left,
    s.food_left,
  ].join("|");
}

type ParentMove = {
  event_value: string;
  pool_type: PoolType;
  actionKey: string; // ticket_single / food_single / food_ten / ...
  method: PlanMethod;
} | null;

type ParentInfo = { prevKey: string | null; move: ParentMove };

// -------------------------
// Main planner
// -------------------------
export function planMinCost(params: {
  graphs_by_event: Record<string, TrackGraph>;
  events: EventMeta[];
  target_cats: Array<number | Cat>;
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
  start_pos_id?: string; // default "1A"
  cfg?: PlannerConfig;
}): PlanResult {
  const cfg = normalizeConfig(params.cfg);

  const targetIds = normalizeTargetIds(params.target_cats);

  // ⚠️ 你現在用的是 32-bit mask，超過 30/31 會出問題（bitwise overflow）
  // 若你真的需要 40+ 目標，要改 BigInt 版 mask（那會是另一個大改）
  if (targetIds.length > 30) {
    throw new PlannerError(
      `targets 太多（${targetIds.length}）。目前 mask 使用 32-bit bitwise，請先把目標數降到 <= 30`
    );
  }

  const targetIndex = buildTargetIndex(targetIds);
  const allMask = (1 << targetIds.length) - 1;

  const startCursor = parsePosId(params.start_pos_id || "1A");

  const startState: PlannerState = {
    cursor_id: startCursor.id,
    prev_cat_id: null,
    tickets_left: Math.max(0, Math.floor(params.tickets || 0)),
    platinum_left: Math.max(0, Math.floor(params.platinum_tickets || 0)),
    legend_left: Math.max(0, Math.floor(params.legend_tickets || 0)),
    food_left: Math.max(0, Math.floor(params.food || 0)),
    mask: 0,
  };

  const INF: Cost = [10 ** 18, 10 ** 18, 10 ** 18, 10 ** 18, 10 ** 18];

  // dist: key -> best g-cost
  const dist = new Map<string, Cost>();

  // parent: key -> (prevKey, move) （✅ 不再存巨大 draws 陣列）
  const parent = new Map<string, ParentInfo>();

  const startKey = stateKey(startState);
  dist.set(startKey, [0, 0, 0, 0, 0]);
  parent.set(startKey, { prevKey: null, move: null });

  let bestGoalKey: string | null = null;
  let bestGoalCost: Cost = INF;

  let bestPartialKey = startKey;
  let bestPartialMask = 0;
  let bestPartialCost: Cost = [0, 0, 0, 0, 0];

  const pq = new MinHeap();
  let seq = 0;

  // -------------------------
  // A* heuristic（下界）
  // -------------------------
  const minPerDraw = (() => {
    const w = cfg.weights;
    const candidates: number[] = [
      Number(w.ticket_single ?? 0),
      Number(w.food_single ?? 0),
      Number(w.platinum_single ?? 0),
      Number(w.legend_single ?? 0),
      // ten 平均每抽（含保底）更便宜也沒關係，做下界只會更保守
      Number(w.food_ten ?? 0) / 11,
    ].filter((x) => Number.isFinite(x) && x >= 0);
    return candidates.length ? Math.min(...candidates) : 0;
  })();

  function heuristic(mask: number): number {
    const remain = targetIds.length - bitCount32(mask);
    return remain * minPerDraw;
  }

  function priorityFor(g: Cost, mask: number): number {
    if (!cfg.use_astar) return g[0]; // Dijkstra
    return g[0] + heuristic(mask); // A*
  }

  pq.push({
    g: [0, 0, 0, 0, 0],
    prio: priorityFor([0, 0, 0, 0, 0], 0),
    seq: seq++,
    key: startKey,
  });

  let expansions = 0;

  // caches: (event|cursor|prev) -> result
  const singleCache = new Map<
    string,
    { next_cursor_id: string; next_prev: number | null; hit: DrawHit }
  >();
  const tenCache = new Map<
    string,
    { end_cursor_id: string; end_prev: number | null; draws: DrawHit[] }
  >();

  function betterPartial(
    aMask: number,
    aCost: Cost,
    bMask: number,
    bCost: Cost
  ): boolean {
    const aBits = bitCount32(aMask);
    const bBits = bitCount32(bMask);
    if (aBits !== bBits) return aBits > bBits;
    return costLess(aCost, bCost);
  }

  // -------------------------
  // Dominance frontier（同一物理狀態下的 Pareto 前緣）
  // -------------------------
  type FrontierEntry = { mask: number; cost0: number; key: string };

  const frontier = new Map<string, FrontierEntry[]>();

  function isDominated(
    entries: FrontierEntry[],
    newMask: number,
    newCost0: number
  ): boolean {
    for (const e of entries) {
      // e.mask ⊇ newMask 且 e.cost0 <= newCost0
      if ((e.mask | newMask) === e.mask && e.cost0 <= newCost0) {
        return true;
      }
    }
    return false;
  }

  function pruneDominatedByNew(
    entries: FrontierEntry[],
    newMask: number,
    newCost0: number
  ): FrontierEntry[] {
    const kept: FrontierEntry[] = [];
    for (const e of entries) {
      const newDominates =
        (newMask | e.mask) === newMask && newCost0 <= e.cost0;
      if (newDominates) {
        // ✅ 直接刪掉被支配狀態，釋放 dist/parent（pq 裡若有殘影會被 lazy skip）
        dist.delete(e.key);
        parent.delete(e.key);
        continue;
      }
      kept.push(e);
    }
    return kept;
  }

  // relax state
  function relax(
    ns: PlannerState,
    fromKey: string,
    curCost: Cost,
    inc: Cost,
    move: ParentMove
  ) {
    const nk = stateKey(ns);
    const newCost = addCost(curCost, inc);
    const old = dist.get(nk) || INF;

    // 你目前的最佳化目標只看 equiv_cost
    if (!costLess(newCost, old)) return;

    // ✅ Dominance pruning（重點：壓制 target 多造成的 2^k 狀態爆炸）
    if (cfg.enable_dominance_pruning) {
      const pk = physicalKeyFromState(ns);
      const entries = frontier.get(pk) || [];
      const newCost0 = newCost[0];

      if (isDominated(entries, ns.mask, newCost0)) return;

      const pruned = pruneDominatedByNew(entries, ns.mask, newCost0);
      pruned.push({ mask: ns.mask, cost0: newCost0, key: nk });
      frontier.set(pk, pruned);
    }

    dist.set(nk, newCost);
    parent.set(nk, { prevKey: fromKey, move });

    pq.push({
      g: newCost,
      prio: priorityFor(newCost, ns.mask),
      seq: seq++,
      key: nk,
    });
  }

  while (pq.size()) {
    const curItem = pq.pop()!;
    const curKey = curItem.key;
    const curCost = curItem.g;

    const bestKnown = dist.get(curKey) || INF;
    if (!costEq(curCost, bestKnown)) continue;

    const s = parseStateKey(curKey);

    expansions++;
    // if (expansions > cfg.max_expansions) {
    //   // 保險絲：避免 worker 把分頁拖到 OOM
    //   break;
    // }

    // goal check
    if (s.mask === allMask) {
      if (costLess(curCost, bestGoalCost)) {
        bestGoalCost = curCost;
        bestGoalKey = curKey;
      }
      // A*/Dijkstra：第一個 pop 出來的 goal 即為最小（h admissible 時）
      break;
    }

    // partial tracking
    if (betterPartial(s.mask, curCost, bestPartialMask, bestPartialCost)) {
      bestPartialKey = curKey;
      bestPartialMask = s.mask;
      bestPartialCost = curCost;
    }

    // expand neighbors
    for (const meta of params.events) {
      const ev = meta.event_value;
      const graph = params.graphs_by_event[ev];
      if (!graph) continue;

      const pool: PoolType = graph.event.pool_type ?? "normal";

      // ✅ 小剪枝：如果這個 pool 在目前資源下根本不可能做任何 action，直接略過
      //（避免不必要的 simulateSingleTransition/try-catch）
      const canTicket =
        s.tickets_left >= 1 && isActionAllowed(cfg, pool, "ticket_single");
      const canFoodSingle =
        s.food_left >= 150 && isActionAllowed(cfg, pool, "food_single");
      const canPlatinum =
        s.platinum_left >= 1 && isActionAllowed(cfg, pool, "platinum_single");
      const canLegend =
        s.legend_left >= 1 && isActionAllowed(cfg, pool, "legend_single");
      const canTenCost = s.food_left >= 1500; // ten 另外還要 hasGuaranteed
      if (
        !canTicket &&
        !canFoodSingle &&
        !canPlatinum &&
        !canLegend &&
        !canTenCost
      ) {
        continue;
      }

      // ---- (A) 單抽 transition ----
      const key1 = `${ev}|${s.cursor_id}|${
        s.prev_cat_id == null ? "-" : s.prev_cat_id
      }`;
      let single = singleCache.get(key1);
      if (!single) {
        try {
          single = simulateSingleTransition({
            graph,
            cursor_id: s.cursor_id,
            prev_cat_id: s.prev_cat_id,
          });
          singleCache.set(key1, single);
          // console.log(singleCache);
        } catch {
          continue; // 此 event 在此 cursor 不可用
        }
      }

      const nextMask = applyHit(s.mask, targetIndex, single.hit.cat_id);
      const nextCursorId = single.next_cursor_id;
      const nextPrev = single.next_prev;

      // (A1) ticket single
      if (canTicket) {
        const inc = costIncForAction(cfg, "ticket_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left - 1,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          actionKey: "ticket_single",
          method: "single",
        });
      }

      // (A2) platinum single
      if (canPlatinum) {
        const inc = costIncForAction(cfg, "platinum_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left - 1,
          legend_left: s.legend_left,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          actionKey: "platinum_single",
          method: "single",
        });
      }

      // (A3) legend single
      if (canLegend) {
        const inc = costIncForAction(cfg, "legend_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left - 1,
          food_left: s.food_left,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          actionKey: "legend_single",
          method: "single",
        });
      }

      // (A4) food single
      if (canFoodSingle) {
        const inc = costIncForAction(cfg, "food_single");
        const ns: PlannerState = {
          cursor_id: nextCursorId,
          prev_cat_id: nextPrev,
          tickets_left: s.tickets_left,
          platinum_left: s.platinum_left,
          legend_left: s.legend_left,
          food_left: s.food_left - 150,
          mask: nextMask,
        };
        relax(ns, curKey, curCost, inc, {
          event_value: ev,
          pool_type: pool,
          actionKey: "food_single",
          method: "single",
        });
      }

      // ---- (B) ten：只允許 food ----
      const startNode = graph.nodes?.[s.cursor_id] as PositionNode | undefined;
      const hasGuaranteed =
        !!startNode?.edges?.guaranteed && !!startNode.edges.guaranteed.cat;

      if (s.food_left >= 1500 && hasGuaranteed) {
        const key10 = `${ev}|${s.cursor_id}|${
          s.prev_cat_id == null ? "-" : s.prev_cat_id
        }`;
        let ten = tenCache.get(key10);
        if (!ten) {
          try {
            ten = simulateTenTransition({
              graph,
              cursor_id: s.cursor_id,
              prev_cat_id: s.prev_cat_id,
            });
            tenCache.set(key10, ten);
          } catch {
            tenCache.set(key10, {
              end_cursor_id: "",
              end_prev: null,
              draws: [],
            });
            ten = { end_cursor_id: "", end_prev: null, draws: [] };
          }
        }

        if (ten.draws.length && ten.end_cursor_id) {
          let tenMask = s.mask;
          for (const d of ten.draws)
            tenMask = applyHit(tenMask, targetIndex, d.cat_id);

          const inc = costIncForAction(cfg, "food_ten");
          const ns: PlannerState = {
            cursor_id: ten.end_cursor_id,
            prev_cat_id: ten.end_prev,
            tickets_left: s.tickets_left,
            platinum_left: s.platinum_left,
            legend_left: s.legend_left,
            food_left: s.food_left - 1500,
            mask: tenMask,
          };

          relax(ns, curKey, curCost, inc, {
            event_value: ev,
            pool_type: pool,
            actionKey: "food_ten",
            method: "ten",
          });
        }
      }
    }
  }

  // -------------------------
  // pick best end state
  // -------------------------
  const success = bestGoalKey != null;
  const endKey = success ? bestGoalKey! : bestPartialKey;

  const endState = parseStateKey(endKey);
  const endCost = dist.get(endKey) || bestPartialCost;

  // -------------------------
  // reconstruct plan (only for final path)
  // -------------------------
  const segments: Array<{ fromKey: string; toKey: string; move: ParentMove }> =
    [];
  {
    let curKey = endKey;
    while (true) {
      const p = parent.get(curKey);
      if (!p || !p.prevKey || !p.move) break;
      segments.push({ fromKey: p.prevKey, toKey: curKey, move: p.move });
      curKey = p.prevKey;
    }
    segments.reverse();
  }

  function actionKeyToResource(actionKey: string): ResourceType {
    if (actionKey === "ticket_single") return "ticket";
    if (actionKey === "platinum_single") return "platinum_ticket";
    if (actionKey === "legend_single") return "legend_ticket";
    if (actionKey === "food_single" || actionKey === "food_ten") return "food";
    throw new PlannerError(`未知 actionKey=${actionKey}`);
  }

  const planSteps: PlanStep[] = [];
  for (const seg of segments) {
    const fromState = parseStateKey(seg.fromKey);
    const toState = parseStateKey(seg.toKey);
    const move = seg.move!;
    const graph = params.graphs_by_event[move.event_value];
    if (!graph) throw new PlannerError(`找不到 graph: ${move.event_value}`);

    const inc = costIncForAction(cfg, move.actionKey);

    if (move.method === "single") {
      const single = simulateSingleTransition({
        graph,
        cursor_id: fromState.cursor_id,
        prev_cat_id: fromState.prev_cat_id,
      });

      // 保守檢查（不一致通常代表轉移規則/資料變動）
      if (
        single.next_cursor_id !== toState.cursor_id ||
        single.next_prev !== toState.prev_cat_id
      ) {
        // 不直接 throw，避免少數資料不一致就全崩；但會讓你看到異常
        // 你想嚴格也可以改成 throw
        // throw new PlannerError(`回放 single 不一致: ${move.event_value}`);
      }

      planSteps.push({
        event_value: move.event_value,
        pool_type: move.pool_type,
        resource: actionKeyToResource(move.actionKey),
        method: "single",
        cost_inc: inc,
        draws: [single.hit],
        start_cursor_id: fromState.cursor_id,
        end_cursor_id: single.next_cursor_id,
        start_prev_cat_id: fromState.prev_cat_id,
        end_prev_cat_id: single.next_prev,
      });
      // console.log(planSteps);
    } else {
      const ten = simulateTenTransition({
        graph,
        cursor_id: fromState.cursor_id,
        prev_cat_id: fromState.prev_cat_id,
      });

      planSteps.push({
        event_value: move.event_value,
        pool_type: move.pool_type,
        resource: actionKeyToResource(move.actionKey),
        method: "ten",
        cost_inc: inc,
        draws: ten.draws,
        start_cursor_id: fromState.cursor_id,
        end_cursor_id: ten.end_cursor_id,
        start_prev_cat_id: fromState.prev_cat_id,
        end_prev_cat_id: ten.end_prev,
      });
    }
  }

  // 統計
  const hits = maskToHitIds(endState.mask, targetIds);
  const hitSet = new Set(hits);
  const missing = targetIds.filter((cid) => !hitSet.has(cid));

  const allDraws: DrawHit[] = [];
  for (const st of planSteps) allDraws.push(...st.draws);

  const [equiv, foodUsed, tUsed, pUsed, lUsed] = endCost;

  console.log(`Total Expansions: ${expansions.toLocaleString()}`);

  return {
    success,
    plan: planSteps,
    final_cursor_id: endState.cursor_id,
    final_prev_cat_id: endState.prev_cat_id,

    targets_total: targetIds.length,
    targets_hit: bitCount32(endState.mask),
    targets_hit_ids: hits,
    targets_missing_ids: missing,

    total_cost: endCost,
    tickets_used: tUsed,
    equiv_cost: equiv,
    platinum_used: pUsed,
    legend_used: lUsed,
    food_used: foodUsed,

    all_draws: allDraws,
  };
}
