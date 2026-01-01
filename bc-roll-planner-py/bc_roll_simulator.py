# bc_roll_simulator.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Literal, Any, Tuple

from bc_roll_models import (
    TrackGraph,
    PositionNode,
    Edge,
    Cat,
    Cursor,
    parse_pos_id,
)

# -------------------------
# 使用者輸入動作格式
# - single: 1抽
# - ten: 10連抽(是否有保底, 模擬器會看起點是否有 AG / guaranteed edge)
# -------------------------
Method = Literal["single", "ten"]


@dataclass(frozen=True)
class SimAction:
    """
    一個動作: 指定使用哪個 event 的 graph 來查表 + 抽法
    - event_value: 用來選 graph
    - method: single / ten
    """

    event_value: str
    method: Method


@dataclass(frozen=True)
class DrawRecord:
    """
    每一次「實際抽到一隻」的紀錄(不管是單抽、10連中的第幾抽、或保底那隻)
    """

    step: int
    event_value: str
    method: Method
    within_action_index: int

    from_pos_id: str

    # edge 類型: normal / switch_track / guaranteed
    # guaranteed 指的是「有 AG 的 10連」才會多出的第 11 隻(來源: 起點的 G 欄)
    used: Literal["normal", "switch_track", "guaranteed"]

    # 這裡不用Cat物件, 直接拆成欄位方便輸出
    cat_id: Optional[int]
    cat_name: str
    cat_desc: str

    to_pos_id: str

    source_pick_id: Optional[str] = None
    note: str = ""


class SimulationError(RuntimeError):
    pass


# -------------------------
# 核心: 單次抽取(在某個 node 上依規則選 normal / switch_track)
# -------------------------
def choose_edge_for_single_draw(
    node: PositionNode,
    prev_cat_id: Optional[int],
) -> Tuple[Edge, Literal["normal", "switch_track"]]:
    """
    規則(採用你例子最符合的版本):
    - 先看 normal edge 抽到的貓
    - 若跟上一抽 cat_id 相同, 且有 switch_track edge, 就走 switch_track
    - 否則走 normal
    """
    edges = node.edges  # Mapping
    normal = edges.get("normal")
    if not normal:
        raise SimulationError(f"位置 {node.id} 缺少 normal edge, 無法單抽")

    normal_cat_id = normal.cat.id if normal.cat else None
    switch = edges.get("switch_track")

    if (
        # 換線條件：連續兩張相同的rare
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
# 主要模擬器
# -------------------------
def simulate(
    graphs_by_event: Dict[str, TrackGraph],
    actions: List[SimAction],
    start_pos_id: str = "1A",
) -> Tuple[List[DrawRecord], Cursor]:
    """
    回傳:
    - records: 每一隻抽到的貓(含每一步位置/跳轉)
    - final_cursor: 最後停的位置

    注意:
    - 切卡池(event)只換 graph, 不改 cursor
    - ten(10連抽):
        1) 一律做 10 次「單抽規則」(每次可能 normal 或 switch_track)
        2) 若「10連起點」存在 guaranteed edge(也就是 AG), 則:
           - 追加第 11 隻(起點的 G 欄)
           - 最終停點: 使用 guaranteed edge.to(若沒有 to 就 fallback +1 換線，但基本上會有)
        3) 若起點沒有 AG: 代表此卡池無保底, 10連就只抽 10 隻, 停在第10抽的落點
    """
    cursor = parse_pos_id(start_pos_id)
    prev_cat_id: Optional[int] = None
    out: List[DrawRecord] = []
    step = 0

    for act in actions:
        if act.event_value not in graphs_by_event:
            raise SimulationError(
                f"找不到 event_value={act.event_value!r} 對應的 graph"
            )

        graph = graphs_by_event[act.event_value]
        method = act.method

        # 單抽
        if method == "single":
            node = graph.nodes.get(cursor.id)
            if not node:
                raise SimulationError(
                    f"[{act.event_value}] graph.nodes 找不到位置 {cursor.id}(count 不夠或資料缺漏)"
                )

            edge, used = choose_edge_for_single_draw(node, prev_cat_id)
            step += 1
            cid, cname, cdesc = cat_payload(edge.cat)

            out.append(
                DrawRecord(
                    step=step,
                    event_value=act.event_value,
                    method=method,
                    within_action_index=1,
                    from_pos_id=cursor.id,
                    used=used,
                    cat_id=cid,
                    cat_name=cname,
                    cat_desc=cdesc,
                    to_pos_id=edge.to,
                    source_pick_id=edge.source_pick_id,
                    note=edge.note or "",
                )
            )

            cursor = parse_pos_id(edge.to)
            prev_cat_id = cid

        # 10連抽
        elif method == "ten":
            # ten 的「起點」很重要: 是否有 AG/guaranteed, 就看這格
            start_cursor = cursor
            start_node = graph.nodes.get(start_cursor.id)
            if not start_node:
                raise SimulationError(
                    f"[{act.event_value}] graph.nodes 找不到起點 {start_cursor.id}, 無法做 10連抽"
                )

            g_edge = start_node.edges.get("guaranteed")
            has_guaranteed = bool(g_edge and g_edge.cat)

            # (1) 先做 10 抽: 依單抽規則逐次走位
            for i in range(1, 10 + 1):
                node = graph.nodes.get(cursor.id)
                if not node:
                    raise SimulationError(
                        f"[{act.event_value}] graph.nodes 找不到位置 {cursor.id}(count 不夠或資料缺漏)"
                    )

                edge, used = choose_edge_for_single_draw(node, prev_cat_id)
                step += 1
                cid, cname, cdesc = cat_payload(edge.cat)

                out.append(
                    DrawRecord(
                        step=step,
                        event_value=act.event_value,
                        method=method,
                        within_action_index=i,
                        from_pos_id=cursor.id,
                        used=used,
                        cat_id=cid,
                        cat_name=cname,
                        cat_desc=cdesc,
                        to_pos_id=edge.to,
                        source_pick_id=edge.source_pick_id,
                        note=edge.note or "",
                    )
                )

                cursor = parse_pos_id(edge.to)
                prev_cat_id = cid

            # (2) 若起點有 AG(guaranteed edge), 才追加第 11 抽(保底)
            if has_guaranteed and g_edge:
                step += 1
                gid, gname, gdesc = cat_payload(g_edge.cat)

                out.append(
                    DrawRecord(
                        step=step,
                        event_value=act.event_value,
                        method=method,
                        within_action_index=11,
                        from_pos_id=start_cursor.id,  # 來源: 起點的 G 欄(例如 1AG)
                        used="guaranteed",
                        cat_id=gid,
                        cat_name=gname,
                        cat_desc=gdesc,
                        to_pos_id="-",
                        source_pick_id=g_edge.source_pick_id,
                        note=(g_edge.note or "guaranteed bonus"),
                    )
                )

                # (3) 有保底才會有「保底結算落點」
                final_to = (g_edge.to or "").strip()
                if final_to:
                    cursor = parse_pos_id(final_to)
                else:
                    # fallback: +1 並換線(保底常見行為)
                    # 印出警告訊息，因為基本上都有 to，不應該走到這裡
                    print(
                        f"[Warning] [{act.event_value}] guaranteed edge 沒有 to，使用 fallback +1 換線"
                    )
                    cursor = Cursor(
                        pos=cursor.pos + 1, track=("B" if cursor.track == "A" else "A")
                    )

                # 下一抽的重複判定, 以保底那隻為上一抽
                prev_cat_id = gid

            # 若沒有 AG: 這個 10連就是純 10 抽, 不追加 bonus, 也不做換線結算
        else:
            raise SimulationError(f"未支援 method={method!r}")

    return out, cursor


# -------------------------
# 方便: 把 input array(dict)轉成 SimAction
# -------------------------
def parse_actions(raw: List[Dict[str, Any]]) -> List[SimAction]:
    """
    支援輸入大概長這樣:
      [{"event_value": "aaa", "method": "10連抽"}, {"event_value": "bbb", "method": "1抽"}, ...]
    """
    out: List[SimAction] = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise SimulationError(f"actions[{i}] 必須是 dict")
        ev = str(item.get("event_value") or "").strip()
        if not ev:
            raise SimulationError(f"actions[{i}] 缺少 event_value")
        method = item.get("method")
        if method not in ("single", "ten"):
            raise SimulationError(
                f"actions[{i}].method 必須是 'single' 或 'ten', 但得到 {method!r}"
            )
        out.append(SimAction(event_value=ev, method=method))
    return out
