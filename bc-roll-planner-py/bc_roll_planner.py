# bc_roll_planner.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Literal, Any, Iterable
import heapq

from bc_roll_models import (
    TrackGraph,
    PositionNode,
    Edge,
    Cat,
    Cursor,
    parse_pos_id,
)


# -------------------------
# Types
# -------------------------
PoolType = Literal["normal", "platinum", "legend"]

ResourceType = Literal[
    "ticket",  # 金券
    "platinum_ticket",  # 白金券
    "legend_ticket",  # 傳說券
    "food",  # 貓罐頭
]

PlanMethod = Literal[
    "single", "ten"
]  # 這裡是 planner 的 method（對應 simulator 的 single/ten）


@dataclass(frozen=True)
class EventMeta:
    event_value: str
    pool_type: PoolType = "normal"


@dataclass(frozen=True)
class PlannerState:
    cursor_id: str
    prev_cat_id: Optional[int]
    tickets_left: int
    platinum_left: int
    legend_left: int
    food_left: int
    mask: int


# 成本向量：用 tuple 做 lexicographic 最小化
# (equiv_cost, food_used, ticket_used, platinum_used, legend_used)
Cost = Tuple[int, int, int, int, int]


@dataclass(frozen=True)
class DrawHit:
    """
    Planner 內部用的抽到結果（比 DrawRecord 更精簡，但保留關鍵資訊）
    """

    cat_id: Optional[int]
    cat_name: str
    cat_desc: str
    used: Literal["normal", "switch_track", "guaranteed"]
    from_pos_id: str
    to_pos_id: str
    source_pick_id: Optional[str] = None
    note: str = ""


@dataclass(frozen=True)
class PlanStep:
    event_value: str
    pool_type: PoolType
    resource: ResourceType
    method: PlanMethod
    cost_inc: Cost
    draws: Tuple[DrawHit, ...]
    # for debugging / auditing:
    start_cursor_id: str
    end_cursor_id: str
    start_prev_cat_id: Optional[int]
    end_prev_cat_id: Optional[int]


@dataclass
class PlanResult:
    success: bool
    plan: List[PlanStep]
    final_cursor_id: str
    final_prev_cat_id: Optional[int]
    targets_total: int
    targets_hit: int
    targets_hit_ids: List[int]
    targets_missing_ids: List[int]
    total_cost: Cost
    tickets_used: int
    platinum_used: int
    legend_used: int
    food_used: int
    all_draws: List[DrawHit]


class PlannerError(RuntimeError):
    pass


# -------------------------
# Config
# -------------------------
@dataclass(frozen=True)
class PlannerConfig:
    # 等價成本（預設都視為一次單抽=150）
    weights: Dict[str, int] = None

    # 十連允許的池類型（通常只有 normal）
    allow_ten_pools: Tuple[PoolType, ...] = ("normal",)

    # 限制白金券 / 傳說券只能用於特定池
    platinum_pool: PoolType = "platinum"
    legend_pool: PoolType = "legend"

    # ✅ 每種池允許哪些抽法（action_key）
    # - normal: 金券單抽、罐頭單抽、罐頭十連
    # - platinum: 只能白金券單抽
    # - legend: 只能傳說券單抽
    allowed_actions_by_pool: Dict[PoolType, Tuple[str, ...]] = None

    # 搜尋上限（避免極端狀況）
    max_expansions: int = 2_000_000

    def __post_init__(self):
        if self.weights is None:
            object.__setattr__(
                self,
                "weights",
                {
                    "ticket_single": 150,
                    "platinum_single": 150,
                    "legend_single": 150,
                    "food_single": 150,
                    "food_ten": 1500,
                },
            )

        if self.allowed_actions_by_pool is None:
            object.__setattr__(
                self,
                "allowed_actions_by_pool",
                {
                    "normal": ("ticket_single", "food_single", "food_ten"),
                    "platinum": ("platinum_single",),
                    "legend": ("legend_single",),
                },
            )

    def is_action_allowed(self, pool: PoolType, action_key: str) -> bool:
        allowed = self.allowed_actions_by_pool.get(pool)
        if not allowed:
            return False
        return action_key in allowed


# -------------------------
# Target mask helpers
# -------------------------
def _normalize_target_ids(targets: Iterable[Any]) -> List[int]:
    """
    目標建議直接用 cat_id(int)。
    也支援 Cat 物件（取 cat.id）。
    """
    out: List[int] = []
    for t in targets:
        if isinstance(t, int):
            out.append(t)
        elif isinstance(t, Cat):
            out.append(t.id)
        else:
            raise PlannerError(
                f"targets 只支援 int(cat_id) 或 Cat，但收到：{type(t).__name__}={t!r}"
            )
    # 去重但保序
    seen = set()
    uniq: List[int] = []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def build_target_index(target_ids: List[int]) -> Dict[int, int]:
    """
    cat_id -> bit_index
    """
    return {cid: i for i, cid in enumerate(target_ids)}


def apply_hit(mask: int, target_index: Dict[int, int], cat_id: Optional[int]) -> int:
    if cat_id is None:
        return mask
    i = target_index.get(cat_id)
    if i is None:
        return mask
    return mask | (1 << i)


def mask_to_hit_ids(mask: int, target_ids: List[int]) -> List[int]:
    out: List[int] = []
    for i, cid in enumerate(target_ids):
        if (mask >> i) & 1:
            out.append(cid)
    return out


# -------------------------
# Core draw rule (same as bc_roll_simulator.choose_edge_for_single_draw)
# -------------------------
def choose_edge_for_single_draw(
    node: PositionNode,
    prev_cat_id: Optional[int],
) -> Tuple[Edge, Literal["normal", "switch_track"]]:
    edges = node.edges
    normal = edges.get("normal")
    if not normal:
        raise PlannerError(f"位置 {node.id} 缺少 normal edge")

    normal_cat_id = normal.cat.id if normal.cat else None
    switch = edges.get("switch_track")

    if (
        node.rarity == "rare"
        and switch
        and prev_cat_id is not None
        and normal_cat_id is not None
        and normal_cat_id == prev_cat_id
    ):
        return switch, "switch_track"

    return normal, "normal"


def cat_payload(cat: Optional[Cat]) -> Tuple[Optional[int], str, str]:
    if not cat:
        return None, "-", ""
    return cat.id, cat.name, cat.desc or ""


# -------------------------
# Transition simulation (single / ten)
# -------------------------
def simulate_single_transition(
    graph: TrackGraph,
    cursor_id: str,
    prev_cat_id: Optional[int],
    target_index: Dict[int, int],
) -> Tuple[str, Optional[int], int, DrawHit]:
    node = graph.nodes.get(cursor_id)
    if not node:
        raise PlannerError(
            f"[{graph.event.value}] 找不到位置 {cursor_id}（count 不夠或資料缺漏）"
        )

    edge, used = choose_edge_for_single_draw(node, prev_cat_id)
    cid, cname, cdesc = cat_payload(edge.cat)
    new_mask_inc = 0
    # mask 更新交給外面 apply_hit，這裡回傳 cat_id 即可

    hit = DrawHit(
        cat_id=cid,
        cat_name=cname,
        cat_desc=cdesc,
        used=used,
        from_pos_id=cursor_id,
        to_pos_id=edge.to,
        source_pick_id=edge.source_pick_id,
        note=edge.note or "",
    )

    next_cursor_id = parse_pos_id(edge.to).id
    next_prev = cid
    return next_cursor_id, next_prev, new_mask_inc, hit


def simulate_ten_transition(
    graph: TrackGraph,
    cursor_id: str,
    prev_cat_id: Optional[int],
) -> Tuple[str, Optional[int], Tuple[DrawHit, ...]]:
    """
    十連規則完全對齊你的 bc_roll_simulator:
    1) 做 10 次單抽規則 (normal/switch_track)
    2) 若起點有 guaranteed edge(AG)，追加第 11 隻（來源: 起點 G 欄），並用 g_edge.to 結算最終 cursor
    """
    start_cursor_id = cursor_id
    start_node = graph.nodes.get(start_cursor_id)
    if not start_node:
        raise PlannerError(f"[{graph.event.value}] 找不到十連起點 {start_cursor_id}")

    g_edge = start_node.edges.get("guaranteed")
    has_guaranteed = bool(g_edge and g_edge.cat)

    draws: List[DrawHit] = []
    cur = cursor_id
    prev = prev_cat_id

    # 10 抽
    for _ in range(10):
        node = graph.nodes.get(cur)
        if not node:
            raise PlannerError(
                f"[{graph.event.value}] 找不到位置 {cur}（count 不夠或資料缺漏）"
            )
        edge, used = choose_edge_for_single_draw(node, prev)
        cid, cname, cdesc = cat_payload(edge.cat)

        draws.append(
            DrawHit(
                cat_id=cid,
                cat_name=cname,
                cat_desc=cdesc,
                used=used,
                from_pos_id=cur,
                to_pos_id=edge.to,
                source_pick_id=edge.source_pick_id,
                note=edge.note or "",
            )
        )
        cur = parse_pos_id(edge.to).id
        prev = cid

    # 第 11 隻保底 + 結算落點
    if has_guaranteed and g_edge:
        gid, gname, gdesc = cat_payload(g_edge.cat)
        draws.append(
            DrawHit(
                cat_id=gid,
                cat_name=gname,
                cat_desc=gdesc,
                used="guaranteed",
                from_pos_id=start_cursor_id,
                to_pos_id="-",
                source_pick_id=g_edge.source_pick_id,
                note=(g_edge.note or "guaranteed bonus"),
            )
        )

        final_to = (g_edge.to or "").strip()
        if not final_to:
            raise PlannerError(
                f"[{graph.event.value}] guaranteed edge 沒有 to，無法結算十連落點"
            )
        cur = parse_pos_id(final_to).id
        prev = gid

    return cur, prev, tuple(draws)


# -------------------------
# Cost helpers
# -------------------------
def add_cost(a: Cost, b: Cost) -> Cost:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4])


def cost_inc_for_action(cfg: PlannerConfig, action_key: str) -> Cost:
    equiv = int(cfg.weights[action_key])
    if action_key == "food_single":
        return (equiv, 150, 0, 0, 0)
    if action_key == "food_ten":
        return (equiv, 1500, 0, 0, 0)
    if action_key == "ticket_single":
        return (equiv, 0, 1, 0, 0)
    if action_key == "platinum_single":
        return (equiv, 0, 0, 1, 0)
    if action_key == "legend_single":
        return (equiv, 0, 0, 0, 1)
    raise PlannerError(f"未知 action_key={action_key!r}")


# -------------------------
# Planner (Dijkstra)
# -------------------------
def plan_min_cost(
    *,
    graphs_by_event: Dict[str, TrackGraph],
    events: List[EventMeta],
    target_cats: List[Any],
    tickets: int,
    platinum_tickets: int,
    legend_tickets: int,
    food: int,
    start_pos_id: str = "1A",
    cfg: Optional[PlannerConfig] = None,
) -> PlanResult:
    """
    主要入口：
    - graphs_by_event: event_value -> TrackGraph（你 scraper 建好的）
    - events: event 清單（含 pool_type，控制白金/傳說券限制）
    - target_cats: 目標貓（建議直接用 cat_id[int]）
    - tickets/platinum_tickets/legend_tickets/food: 你的資源
    - start_pos_id: 起點，預設 1A
    """
    cfg = cfg or PlannerConfig()

    target_ids = _normalize_target_ids(target_cats)
    target_index = build_target_index(target_ids)
    all_mask = (1 << len(target_ids)) - 1

    start_cursor = parse_pos_id(start_pos_id)

    start_state = PlannerState(
        cursor_id=start_cursor.id,
        prev_cat_id=None,
        tickets_left=max(0, int(tickets)),
        platinum_left=max(0, int(platinum_tickets)),
        legend_left=max(0, int(legend_tickets)),
        food_left=max(0, int(food)),
        mask=0,
    )

    # dist / parent
    INF_COST: Cost = (10**18, 10**18, 10**18, 10**18, 10**18)
    dist: Dict[PlannerState, Cost] = {start_state: (0, 0, 0, 0, 0)}
    parent: Dict[PlannerState, Tuple[Optional[PlannerState], Optional[PlanStep]]] = {
        start_state: (None, None)
    }

    # best goal
    best_goal_state: Optional[PlannerState] = None
    best_goal_cost: Cost = INF_COST

    # best partial (for fallback)
    best_partial_state: PlannerState = start_state
    best_partial_cost: Cost = (0, 0, 0, 0, 0)

    # priority queue: (cost_tuple, seq, state)
    pq: List[Tuple[Cost, int, PlannerState]] = []
    seq = 0
    heapq.heappush(pq, (dist[start_state], seq, start_state))

    expansions = 0

    # 快取：相同 (event, cursor, prev) 的單抽/十連結果
    single_cache: Dict[
        Tuple[str, str, Optional[int]], Tuple[str, Optional[int], DrawHit]
    ] = {}
    ten_cache: Dict[
        Tuple[str, str, Optional[int]], Tuple[str, Optional[int], Tuple[DrawHit, ...]]
    ] = {}

    def better_partial(a_mask: int, a_cost: Cost, b_mask: int, b_cost: Cost) -> bool:
        """
        partial 比較：先比達成目標數量，再比成本
        """
        a_bits = a_mask.bit_count()
        b_bits = b_mask.bit_count()
        if a_bits != b_bits:
            return a_bits > b_bits
        return a_cost < b_cost

    while pq:
        cur_cost, _, s = heapq.heappop(pq)
        if cur_cost != dist.get(s, INF_COST):
            continue

        expansions += 1
        if expansions > cfg.max_expansions:
            break

        # goal check
        if s.mask == all_mask:
            if cur_cost < best_goal_cost:
                best_goal_cost = cur_cost
                best_goal_state = s
            # Dijkstra：第一個到 goal 已經是最小（在 lexicographic cost 下也成立）
            # 但我們仍可直接 break 提速
            break

        # partial tracking
        if better_partial(s.mask, cur_cost, best_partial_state.mask, best_partial_cost):
            best_partial_state = s
            best_partial_cost = cur_cost

        # 展開 neighbors
        for meta in events:
            ev = meta.event_value
            pool = meta.pool_type
            graph = graphs_by_event.get(ev)
            if not graph:
                # 事件 meta 有，但 graph 沒準備好就跳過
                continue

            # --- (A) 單抽：通用 transition（結果不依資源種類） ---
            key1 = (ev, s.cursor_id, s.prev_cat_id)
            if key1 in single_cache:
                next_cursor_id, next_prev, hit = single_cache[key1]
            else:
                try:
                    next_cursor_id, next_prev, _, hit = simulate_single_transition(
                        graph, s.cursor_id, s.prev_cat_id, target_index
                    )
                except Exception:
                    # count 不夠或缺 node：此 event 在此 cursor 不可用
                    continue
                single_cache[key1] = (next_cursor_id, next_prev, hit)

            # 更新 mask
            next_mask = apply_hit(s.mask, target_index, hit.cat_id)

            # (A1) 金券單抽
            if s.tickets_left >= 1 and cfg.is_action_allowed(pool, "ticket_single"):
                inc = cost_inc_for_action(cfg, "ticket_single")
                ns = PlannerState(
                    cursor_id=next_cursor_id,
                    prev_cat_id=next_prev,
                    tickets_left=s.tickets_left - 1,
                    platinum_left=s.platinum_left,
                    legend_left=s.legend_left,
                    food_left=s.food_left,
                    mask=next_mask,
                )
                new_cost = add_cost(cur_cost, inc)
                if new_cost < dist.get(ns, INF_COST):
                    dist[ns] = new_cost
                    step = PlanStep(
                        event_value=ev,
                        pool_type=pool,
                        resource="ticket",
                        method="single",
                        cost_inc=inc,
                        draws=(hit,),
                        start_cursor_id=s.cursor_id,
                        end_cursor_id=next_cursor_id,
                        start_prev_cat_id=s.prev_cat_id,
                        end_prev_cat_id=next_prev,
                    )
                    parent[ns] = (s, step)
                    seq += 1
                    heapq.heappush(pq, (new_cost, seq, ns))

            # (A2) 白金券單抽（只限白金池）
            if s.platinum_left >= 1 and cfg.is_action_allowed(pool, "platinum_single"):
                inc = cost_inc_for_action(cfg, "platinum_single")
                ns = PlannerState(
                    cursor_id=next_cursor_id,
                    prev_cat_id=next_prev,
                    tickets_left=s.tickets_left,
                    platinum_left=s.platinum_left - 1,
                    legend_left=s.legend_left,
                    food_left=s.food_left,
                    mask=next_mask,
                )
                new_cost = add_cost(cur_cost, inc)
                if new_cost < dist.get(ns, INF_COST):
                    dist[ns] = new_cost
                    step = PlanStep(
                        event_value=ev,
                        pool_type=pool,
                        resource="platinum_ticket",
                        method="single",
                        cost_inc=inc,
                        draws=(hit,),
                        start_cursor_id=s.cursor_id,
                        end_cursor_id=next_cursor_id,
                        start_prev_cat_id=s.prev_cat_id,
                        end_prev_cat_id=next_prev,
                    )
                    parent[ns] = (s, step)
                    seq += 1
                    heapq.heappush(pq, (new_cost, seq, ns))

            # (A3) 傳說券單抽（只限傳說池）
            if s.legend_left >= 1 and cfg.is_action_allowed(pool, "legend_single"):
                inc = cost_inc_for_action(cfg, "legend_single")
                ns = PlannerState(
                    cursor_id=next_cursor_id,
                    prev_cat_id=next_prev,
                    tickets_left=s.tickets_left,
                    platinum_left=s.platinum_left,
                    legend_left=s.legend_left - 1,
                    food_left=s.food_left,
                    mask=next_mask,
                )
                new_cost = add_cost(cur_cost, inc)
                if new_cost < dist.get(ns, INF_COST):
                    dist[ns] = new_cost
                    step = PlanStep(
                        event_value=ev,
                        pool_type=pool,
                        resource="legend_ticket",
                        method="single",
                        cost_inc=inc,
                        draws=(hit,),
                        start_cursor_id=s.cursor_id,
                        end_cursor_id=next_cursor_id,
                        start_prev_cat_id=s.prev_cat_id,
                        end_prev_cat_id=next_prev,
                    )
                    parent[ns] = (s, step)
                    seq += 1
                    heapq.heappush(pq, (new_cost, seq, ns))

            # (A4) 罐頭單抽
            if s.food_left >= 150 and cfg.is_action_allowed(pool, "food_single"):
                inc = cost_inc_for_action(cfg, "food_single")
                ns = PlannerState(
                    cursor_id=next_cursor_id,
                    prev_cat_id=next_prev,
                    tickets_left=s.tickets_left,
                    platinum_left=s.platinum_left,
                    legend_left=s.legend_left,
                    food_left=s.food_left - 150,
                    mask=next_mask,
                )
                new_cost = add_cost(cur_cost, inc)
                if new_cost < dist.get(ns, INF_COST):
                    dist[ns] = new_cost
                    step = PlanStep(
                        event_value=ev,
                        pool_type=pool,
                        resource="food",
                        method="single",
                        cost_inc=inc,
                        draws=(hit,),
                        start_cursor_id=s.cursor_id,
                        end_cursor_id=next_cursor_id,
                        start_prev_cat_id=s.prev_cat_id,
                        end_prev_cat_id=next_prev,
                    )
                    parent[ns] = (s, step)
                    seq += 1
                    heapq.heappush(pq, (new_cost, seq, ns))

            # --- (B) 十連：只允許 food + 指定池類型 ---
            if (
                s.food_left >= 1500
                and pool in cfg.allow_ten_pools
                and cfg.is_action_allowed(pool, "food_ten")
            ):
                key10 = (ev, s.cursor_id, s.prev_cat_id)
                if key10 in ten_cache:
                    ten_end_cursor_id, ten_end_prev, ten_draws = ten_cache[key10]
                else:
                    try:
                        ten_end_cursor_id, ten_end_prev, ten_draws = (
                            simulate_ten_transition(graph, s.cursor_id, s.prev_cat_id)
                        )
                    except Exception:
                        # 此 event 在此 cursor 無法十連
                        ten_cache[key10] = ("", None, tuple())
                        ten_end_cursor_id, ten_end_prev, ten_draws = ("", None, tuple())
                    else:
                        ten_cache[key10] = (ten_end_cursor_id, ten_end_prev, ten_draws)

                if ten_draws and ten_end_cursor_id:
                    ten_mask = s.mask
                    for d in ten_draws:
                        ten_mask = apply_hit(ten_mask, target_index, d.cat_id)

                    inc = cost_inc_for_action(cfg, "food_ten")
                    ns = PlannerState(
                        cursor_id=ten_end_cursor_id,
                        prev_cat_id=ten_end_prev,
                        tickets_left=s.tickets_left,
                        platinum_left=s.platinum_left,
                        legend_left=s.legend_left,
                        food_left=s.food_left - 1500,
                        mask=ten_mask,
                    )
                    new_cost = add_cost(cur_cost, inc)
                    if new_cost < dist.get(ns, INF_COST):
                        dist[ns] = new_cost
                        step = PlanStep(
                            event_value=ev,
                            pool_type=pool,
                            resource="food",
                            method="ten",
                            cost_inc=inc,
                            draws=ten_draws,
                            start_cursor_id=s.cursor_id,
                            end_cursor_id=ten_end_cursor_id,
                            start_prev_cat_id=s.prev_cat_id,
                            end_prev_cat_id=ten_end_prev,
                        )
                        parent[ns] = (s, step)
                        seq += 1
                        heapq.heappush(pq, (new_cost, seq, ns))

    # -------------------------
    # pick best end state
    # -------------------------
    end_state: PlannerState
    end_cost: Cost
    success: bool

    if best_goal_state is not None:
        end_state = best_goal_state
        end_cost = best_goal_cost
        success = True
    else:
        end_state = best_partial_state
        end_cost = dist.get(end_state, best_partial_cost)
        success = False

    # 回溯組 plan
    plan_steps: List[PlanStep] = []
    cur = end_state
    while True:
        p = parent.get(cur)
        if not p:
            break
        prev_state, step = p
        if prev_state is None or step is None:
            break
        plan_steps.append(step)
        cur = prev_state
    plan_steps.reverse()

    # 統計
    total_food_used = end_cost[1]
    total_ticket_used = end_cost[2]
    total_platinum_used = end_cost[3]
    total_legend_used = end_cost[4]

    hits = mask_to_hit_ids(end_state.mask, target_ids)
    missing = [cid for cid in target_ids if cid not in set(hits)]

    all_draws: List[DrawHit] = []
    for st in plan_steps:
        all_draws.extend(list(st.draws))

    return PlanResult(
        success=success,
        plan=plan_steps,
        final_cursor_id=end_state.cursor_id,
        final_prev_cat_id=end_state.prev_cat_id,
        targets_total=len(target_ids),
        targets_hit=end_state.mask.bit_count(),
        targets_hit_ids=hits,
        targets_missing_ids=missing,
        total_cost=end_cost,
        tickets_used=total_ticket_used,
        platinum_used=total_platinum_used,
        legend_used=total_legend_used,
        food_used=total_food_used,
        all_draws=all_draws,
    )


# -------------------------
# Convenience: build EventMeta list quickly
# -------------------------
def build_events(
    items: List[Dict[str, Any]],
    *,
    default_pool: PoolType = "normal",
) -> List[EventMeta]:
    """
    讓你可以用 dict 清單快速建立 events：
    [
      {"event_value":"2025-12-12_1020", "pool_type":"normal"},
      {"event_value":"...", "pool_type":"platinum"},
      {"event_value":"...", "pool_type":"legend"},
    ]
    """
    out: List[EventMeta] = []
    for it in items:
        ev = str(it.get("event_value") or "").strip()
        if not ev:
            raise PlannerError("events item 缺少 event_value")
        pt = it.get("pool_type", default_pool)
        if pt not in ("normal", "platinum", "legend"):
            raise PlannerError(f"不支援 pool_type={pt!r}")
        out.append(EventMeta(event_value=ev, pool_type=pt))
    return out
