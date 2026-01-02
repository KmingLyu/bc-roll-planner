# run_planner.py
from __future__ import annotations

import argparse
import json
import unicodedata
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

    # -------- pretty print helpers --------
    def _trim(s: str, max_len: int) -> str:
        s = str(s)
        return s if len(s) <= max_len else (s[: max_len - 1] + "…")

    # 以「顯示寬度」做對齊：CJK 全形字元一般佔 2 格，ASCII 佔 1 格
    def _display_width(text: str) -> int:
        w = 0
        for ch in str(text):
            # combining marks 不計寬
            if unicodedata.combining(ch):
                continue
            w += 2 if unicodedata.east_asian_width(ch) in ("F", "W") else 1
        return w

    def _cell(text: str, width: int, align: str = "left") -> str:
        s = str(text)
        pad = width - _display_width(s)
        if pad <= 0:
            return s
        if align == "right":
            return (" " * pad) + s
        return s + (" " * pad)

    def _print_table(
        headers: list[tuple[str, int, str]], rows: list[list[str]]
    ) -> None:
        # headers: [(title, width, align)]
        sep = "  "
        if not headers:
            return

        # 欄寬自動擴展：不截斷、不加省略號，確保中文字對齊
        col_count = len(headers)
        widths: list[int] = [0] * col_count
        for i, (title, min_w, _) in enumerate(headers):
            widths[i] = max(int(min_w), _display_width(title))

        for row in rows:
            if len(row) != col_count:
                raise ValueError(
                    f"table row 欄位數不符：expected {col_count}, got {len(row)}"
                )
            for i, val in enumerate(row):
                widths[i] = max(widths[i], _display_width(val))

        line_len = sum(widths) + len(sep) * (col_count - 1)
        print(
            sep.join(
                _cell(title, widths[i], "left")
                for i, (title, _, _) in enumerate(headers)
            )
        )
        print("-" * line_len)
        for row in rows:
            print(
                sep.join(
                    _cell(val, widths[i], headers[i][2]) for i, val in enumerate(row)
                )
            )

    # 讓 method 呈現更直觀（不假設內部 enum，做保守處理）
    def _method_label(method: str) -> str:
        m = str(method).lower()
        if "10" in m:
            return "10抽"
        if "ten" in m:
            return "10抽"
        if "single" in m or "one" in m or "1" == m:
            return "單抽"
        return str(method)

    # 將 steps 展平成「每一抽」都帶上下文資訊（event/pool/resource/method）
    flat_draws = []
    global_idx = 1
    for step_idx, step in enumerate(res.plan, start=1):
        for draw_idx, d in enumerate(step.draws, start=1):
            flat_draws.append(
                {
                    "gidx": global_idx,
                    "step": step_idx,
                    "didx": draw_idx,
                    "event": str(step.event_value),
                    "pool": str(step.pool_type),
                    "res": str(step.resource),
                    "method": _method_label(step.method),
                    "used": str(d.used),
                    "cat_id": str(d.cat_id),
                    "cat_name": str(d.cat_name),
                    "from": str(d.from_pos_id),
                    "to": str(d.to_pos_id),
                }
            )
            global_idx += 1

    print("\n--- Plan steps (summary) ---")
    step_headers = [
        ("#", 2, "right"),
        ("event", 10, "left"),
        ("pool", 8, "left"),
        ("resource", 10, "left"),
        ("method", 4, "left"),
        ("draws", 5, "right"),
        ("cursor", 15, "left"),
    ]
    step_rows: list[list[str]] = []
    for i, step in enumerate(res.plan, start=1):
        cursor = f"{step.start_cursor_id}->{step.end_cursor_id}"
        step_rows.append(
            [
                str(i),
                str(step.event_value),
                str(step.pool_type),
                str(step.resource),
                _method_label(step.method),
                str(len(step.draws)),
                cursor,
            ]
        )
    _print_table(step_headers, step_rows)

    print("\n--- Draws (每一抽含卡池/資源/抽法) ---")
    draw_headers = [
        ("S#", 3, "right"),
        ("event", 10, "left"),
        ("pool", 8, "left"),
        ("resource", 10, "left"),
        ("method", 4, "left"),
        ("used", 11, "left"),
        ("cat", 4, "right"),
        ("name", 24, "left"),
        ("pos", 12, "left"),
    ]
    draw_rows: list[list[str]] = []
    for r in flat_draws:
        name = str(r["cat_name"])
        pos = f"{r['from']}->{r['to']}"
        draw_rows.append(
            [
                str(r["step"]),
                str(r["event"]),
                str(r["pool"]),
                str(r["res"]),
                str(r["method"]),
                str(r["used"]),
                str(r["cat_id"]),
                name,
                pos,
            ]
        )
    _print_table(draw_headers, draw_rows)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
