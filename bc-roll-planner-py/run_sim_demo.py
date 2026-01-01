# run_sim_demo.py
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

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


def print_action_plan(plan: List[dict]) -> None:
    print("\n=== Action Plan(將會切卡池) ===")
    for i, a in enumerate(plan, start=1):
        print(f"{i:>2}. event={a['event_value']}  method={a['method']}")


def print_records(records, final_cursor) -> None:
    """印出 simulate 的抽卡結果"""
    print("\n=== Draw Records ===")
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


def load_plan(path: str) -> List[dict]:
    """
    從檔案讀取 action plan
    - .json  : 內容為 list[dict]
    - .jsonl : 每行一個 dict
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"找不到 plan 檔案: {path}")

    if p.suffix.lower() == ".jsonl":
        plan: List[dict] = []
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
            s = line.strip()
            if not s:
                continue
            try:
                obj = json.loads(s)
            except json.JSONDecodeError as e:
                raise ValueError(f"JSONL 第 {i} 行解析失敗: {e}") from e
            plan.append(obj)
        return plan

    if p.suffix.lower() == ".json":
        obj = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(obj, list):
            raise ValueError("JSON plan 必須是陣列(list)，例如: [{...}, {...}]")
        return obj

    raise ValueError("只支援 .json 或 .jsonl 的 plan 檔案")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="示範：取得即將到來的活動 -> 建立圖形 -> 模擬 -> 印出結果"
    )
    ap.add_argument("--seed", default="1234", help="種子碼 (預設: 1234)")
    ap.add_argument("--count", type=int, default=80, help="格數 (預設: 80)")
    ap.add_argument("--start", default="1A", help="起始位置編號 (預設: 1A)")
    ap.add_argument("--lang", default="tw", help="語言設定 (預設: tw)")
    ap.add_argument("--ui", default="tw", help="介面語言 (預設: tw)")
    ap.add_argument(
        "--base-url",
        default="https://bc.godfat.org",
        help="網址 (預設: https://bc.godfat.org)",
    )
    ap.add_argument(
        "--plan-file",
        required=True,
        help="action plan 檔案路徑（.json 或 .jsonl）",
    )
    args = ap.parse_args()

    scraper = BattleCatsScraper(base_url=args.base_url, lang=args.lang, ui=args.ui)

    # 0) 讀 plan
    try:
        plan = load_plan(args.plan_file)
    except Exception as e:
        print("讀取 plan 失敗：", e)
        return 3

    if not plan:
        print("plan 是空的，沒有任何動作可模擬")
        return 3

    print("\n=== Using plan file ===")
    print_action_plan(plan)

    # 1) 找 upcoming events（用來補 name / 日期；找不到也沒關係）
    upcoming = scraper.get_upcoming_events()
    if not upcoming:
        print(
            "找不到 Upcoming events(可能網站結構變了或被擋)，仍嘗試用 plan 的 event_value 建圖"
        )
        upcoming_map: Dict[str, Event] = {}
    else:
        print_events(upcoming, max_rows=40)
        upcoming_map = {e.value: e for e in upcoming}

    # 2) 建 graphs(每個 event 一張)
    graphs_by_event: Dict[str, TrackGraph] = {}
    print("\n=== Build graphs ===")

    need_values = sorted({p["event_value"] for p in plan})
    for v in need_values:
        ev = upcoming_map.get(v) or Event(
            value=v, name=v, start_date=None, end_date=None
        )
        print(f"Fetching graph: event={ev.value} count={args.count} ...")
        g = scraper.build_track_graph(seed=args.seed, count=args.count, event=ev)
        graphs_by_event[ev.value] = g
        print(f"  OK: nodes={len(g.nodes)}")

    # 3) simulate
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
