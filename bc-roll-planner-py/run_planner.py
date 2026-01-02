# run_planner.py
from __future__ import annotations

import argparse
import json
from typing import Any, Dict

from bc_roll_models import Event
from bc_roll_scraper import BattleCatsScraper
from bc_roll_planner import plan_min_cost, build_events


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def must(d: Dict[str, Any], key: str):
    if key not in d:
        raise ValueError(f"缺少必要欄位: {key}")
    return d[key]


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Run bc_roll_planner from a JSON test case."
    )
    ap.add_argument("path", help="test case json path, e.g. test_case_01.json")
    args = ap.parse_args()

    cfg = load_json(args.path)

    seed = str(must(cfg, "seed"))
    start_pos_id = str(cfg.get("start_pos_id", "1A"))
    count = int(cfg.get("count", 120))

    targets = cfg.get("targets", [])
    if not isinstance(targets, list) or not targets:
        raise ValueError("targets 必須是非空 list，例如 [726, 706]")

    resources = cfg.get("resources", {})
    if not isinstance(resources, dict):
        raise ValueError("resources 必須是 dict")

    tickets = int(resources.get("tickets", 0))
    platinum_tickets = int(resources.get("platinum_tickets", 0))
    legend_tickets = int(resources.get("legend_tickets", 0))
    food = int(resources.get("food", 0))

    events_cfg = cfg.get("events", [])
    if not isinstance(events_cfg, list) or not events_cfg:
        raise ValueError("events 必須是非空 list")

    # 1) scraper：把每個 event 建成 TrackGraph
    scraper = BattleCatsScraper()

    graphs_by_event = {}
    for e in events_cfg:
        ev_value = str(must(e, "event_value"))
        ev_name = str(must(e, "name"))
        ev = Event(
            value=ev_value,
            name=ev_name,
            start_date=e.get("start_date"),
            end_date=e.get("end_date"),
        )
        g = scraper.build_track_graph(seed=seed, count=count, event=ev)
        graphs_by_event[ev.value] = g

    # 2) planner 用的 EventMeta（只需要 event_value + pool_type）
    events_meta = build_events(
        [
            {"event_value": e["event_value"], "pool_type": e.get("pool_type", "normal")}
            for e in events_cfg
        ]
    )

    # 3) 跑 planner
    res = plan_min_cost(
        graphs_by_event=graphs_by_event,
        events=events_meta,
        target_cats=targets,
        tickets=tickets,
        platinum_tickets=platinum_tickets,
        legend_tickets=legend_tickets,
        food=food,
        start_pos_id=start_pos_id,
    )

    # 4) 輸出
    print("=== PLAN RESULT ===")
    print("Success:", res.success)
    print("Targets hit:", res.targets_hit_ids)
    print("Targets missing:", res.targets_missing_ids)
    print("Final cursor:", res.final_cursor_id)

    equiv, food_used, t_used, p_used, l_used = res.total_cost
    print("--- Cost ---")
    print("equivalent_cost:", equiv)
    print("food_used:", food_used)
    print("tickets_used:", t_used)
    print("platinum_used:", p_used)
    print("legend_used:", l_used)

    print("\n--- Plan steps ---")
    for i, step in enumerate(res.plan, start=1):
        print(
            f"{i:02d}. event={step.event_value} pool={step.pool_type} "
            f"resource={step.resource} method={step.method} "
            f"draws={len(step.draws)} cursor: {step.start_cursor_id}->{step.end_cursor_id}"
        )
        # 每步只預覽前 5 隻，避免輸出太長
        for d in step.draws[:5]:
            print(
                f"    - {d.used:11s} {d.cat_id} {d.cat_name} ({d.from_pos_id}->{d.to_pos_id})"
            )
        if len(step.draws) > 5:
            print("    ...")

    print("\n--- All draws ---")
    for i, d in enumerate(res.all_draws, start=1):
        print(
            f"{i:03d}. {d.used:11s} {d.cat_id} {d.cat_name} ({d.from_pos_id}->{d.to_pos_id})"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
