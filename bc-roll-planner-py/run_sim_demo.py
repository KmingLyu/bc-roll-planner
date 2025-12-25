# run_sim_demo.py
from __future__ import annotations

import argparse
import random
from typing import Dict, List, Optional

from wcwidth import wcswidth

from bc_roll_scraper import BattleCatsScraper
from bc_roll_models import Event, TrackGraph
from bc_roll_simulator import simulate, parse_actions, SimulationError


def pad_disp(text: str, width: int) -> str:
    """依終端機顯示寬度補空白(中文=2格)"""
    text = text or ""
    w = wcswidth(text)
    if w < 0:
        w = len(text)
    if w >= width:
        return text
    return text + " " * (width - w)


def print_events(events: List[Event], max_rows: int = 30) -> None:
    print("\n=== Upcoming events(最多顯示前 {} 筆) ===".format(max_rows))
    for i, e in enumerate(events[:max_rows], start=1):
        date = ""
        if e.start_date or e.end_date:
            date = f" ({e.start_date or '-'} ~ {e.end_date or '-'})"
        print(f"{i:>2}. {e.value}  {e.name}{date}")
    if len(events) > max_rows:
        print(f"...(共 {len(events)} 筆，僅顯示前 {max_rows} 筆)")


def build_random_action_plan(
    picked_events: List[Event],
    steps: int,
    p_guaranteed: float = 0.35,
) -> List[dict]:
    """
    產生一串隨機動作：
    - 每一步會隨機挑一個 event_value(會出現切卡池)
    - method 以一定機率選 10連保底，其他選 1抽
    """
    plan: List[dict] = []
    for _ in range(steps):
        ev = random.choice(picked_events).value
        # method = "10連抽保底" if random.random() < p_guaranteed else "1抽"
        method = "10連抽" if random.random() < p_guaranteed else "1抽"
        plan.append({"event_value": ev, "method": method})
    return plan


def print_action_plan(plan: List[dict]) -> None:
    print("\n=== Action Plan(將會切卡池) ===")
    for i, a in enumerate(plan, start=1):
        print(f"{i:>2}. event={a['event_value']}  method={a['method']}")


def print_records(records, final_cursor) -> None:
    """
    印出 simulate 的抽卡結果
    """
    print("\n=== Draw Records ===")
    # 欄寬(依顯示寬度)
    W_STEP = 5
    W_EV = 16
    W_FROM = 6
    W_USED = 16
    W_CAT = 18
    W_TO = 6

    header = (
        pad_disp("step", W_STEP)
        + pad_disp("event", W_EV)
        + pad_disp("from", W_FROM)
        + pad_disp("used", W_USED)
        + pad_disp("cat", W_CAT)
        + pad_disp("to", W_TO)
        + "  source"
    )
    print(header)
    print("-" * max(80, wcswidth(header)))

    for r in records:
        cat_txt = f"{r.cat_name}" if r.cat_name else "-"
        used_txt = r.used
        src_txt = r.source_pick_id or "-"
        line = (
            pad_disp(str(r.step), W_STEP)
            + pad_disp(r.event_value[:15], W_EV)
            + pad_disp(r.from_pos_id, W_FROM)
            + pad_disp(used_txt, W_USED)
            + pad_disp(cat_txt, W_CAT)
            + pad_disp(r.to_pos_id, W_TO)
            + f"  {src_txt}"
        )
        print(line)

    print(f"\nFinal cursor: {final_cursor.id}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="示範：取得即將到來的活動 -> 建立圖形 -> 模擬 -> 印出結果"
    )
    ap.add_argument("--seed", default="1234", help="種子碼 (預設: 1234)")
    ap.add_argument("--count", type=int, default=80, help="軌道數量 (預設: 80)")
    ap.add_argument(
        "--pick",
        type=int,
        default=3,
        help="隨機挑選多少個即將到來的活動 (預設: 3)",
    )
    ap.add_argument("--steps", type=int, default=6, help="要模擬多少個動作 (預設: 6)")
    ap.add_argument(
        "--p-g",
        type=float,
        default=0.35,
        help="每個動作使用10連抽的機率 (預設: 0.35)",
    )
    ap.add_argument("--start", default="1A", help="起始位置編號 (預設: 1A)")
    ap.add_argument("--lang", default="tw", help="語言設定 (預設: tw)")
    ap.add_argument("--ui", default="tw", help="介面語言 (預設: tw)")
    ap.add_argument(
        "--base-url",
        default="https://bc.godfat.org",
        help="網址 (預設: https://bc.godfat.org)",
    )
    ap.add_argument(
        "--mode",
        choices=["example", "random"],
        default="example",
        help="使用程式內部example還是隨機產生動作 (預設: example)",
    )
    args = ap.parse_args()

    random.seed()  # 使用系統熵

    scraper = BattleCatsScraper(base_url=args.base_url, lang=args.lang, ui=args.ui)

    # 1) 找 upcoming events
    upcoming = scraper.get_upcoming_events()
    if not upcoming:
        print("找不到 Upcoming events(可能網站結構變了或被擋)")
        return 1
    print_events(upcoming, max_rows=40)

    # 2) 挑幾個 event 來建立圖形
    examples = [
        {"event_value": "2025-12-12_1020", "method": "ten"},
        {"event_value": "2025-12-12_1019", "method": "single"},
        {"event_value": "2025-12-12_1019", "method": "single"},
        {"event_value": "2025-12-12_1019", "method": "single"},
        {"event_value": "2025-12-12_1019", "method": "single"},
        {"event_value": "2025-12-12_1019", "method": "ten"},
        {"event_value": "2025-12-12_1020", "method": "single"},
    ]

    if args.mode == "example":
        # 使用內建的 example
        plan = examples
        print("\n=== Using example action plan ===")
    else:
        # random 產生動作
        k = min(max(args.pick, 1), len(upcoming))
        picked = random.sample(upcoming, k=k)
        print(picked)
        print("\n=== Picked events ===")
        for e in picked:
            print(f"- {e.value}  {e.name}")

    print_action_plan(plan)

    # 3) 建 graphs(每個 event 一張)
    graphs_by_event: Dict[str, TrackGraph] = {}
    print("\n=== Build graphs ===")

    if args.mode == "example":
        # 使用內建的 example
        need_values = sorted({p["event_value"] for p in plan})
        upcoming_map = {e.value: e for e in upcoming}
        for v in need_values:
            ev = upcoming_map.get(v)
            if not ev:
                # 如果這個 event 不在 upcoming 裡（例如已變 past），仍然可以用最簡單的 Event 建 graph
                ev = Event(value=v, name=v, start_date=None, end_date=None)
            print(f"Fetching graph: event={ev.value} count={args.count} ...")
            g = scraper.build_track_graph(seed=args.seed, count=args.count, event=ev)
            graphs_by_event[ev.value] = g
            print(f"  OK: nodes={len(g.nodes)}")

    else:
        need_values = sorted({p["event_value"] for p in plan})
        upcoming_map = {e.value: e for e in upcoming}
        for v in need_values:
            ev = upcoming_map.get(v) or Event(
                value=v, name=v, start_date=None, end_date=None
            )
            print(f"Fetching graph: event={ev.value} count={args.count} ...")
            g = scraper.build_track_graph(seed=args.seed, count=args.count, event=ev)
            graphs_by_event[ev.value] = g
            print(f"  OK: nodes={len(g.nodes)}")

    # # 4) 隨機產生 action plan，simulate，印出結果
    # plan = build_random_action_plan(picked, steps=args.steps, p_guaranteed=args.p_g)
    # print_action_plan(plan)

    actions = parse_actions(plan)
    try:
        records, final_cursor = simulate(
            graphs_by_event=graphs_by_event,
            actions=actions,
            start_pos_id=args.start,
        )
    except SimulationError as ex:
        print("\nSimulationError:", ex)
        return 2

    print_records(records, final_cursor)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
