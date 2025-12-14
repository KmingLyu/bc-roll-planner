from __future__ import annotations

import argparse
from wcwidth import wcswidth
from typing import Optional, List

from bc_roll_scraper import BattleCatsScraper
from bc_roll_models import Event


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape bc.godfat.org tracks as TrackGraph")
    parser.add_argument("--seed", required=True, help="Seed, e.g. 1234")
    parser.add_argument("--count", type=int, default=50, help="Count, e.g. 20/50/100")
    parser.add_argument("--event", required=True, help="Event value, e.g. 2025-12-12_1020")
    parser.add_argument("--lang", default="tw", help="lang param")
    parser.add_argument("--ui", default="tw", help="ui param")
    parser.add_argument("--base-url", default="https://bc.godfat.org", help="Base url")
    parser.add_argument("--export", default="", help="Export graph JSON path (optional)")
    args = parser.parse_args(argv)

    scraper = BattleCatsScraper(base_url=args.base_url, lang=args.lang, ui=args.ui)

    # 你也可以先 scraper.get_upcoming_events() 再挑 event
    # 這裡給你最少依賴：直接用 event value 當 Event
    event = Event(value=args.event, name=args.event, start_date=None, end_date=None)

    graph = scraper.build_track_graph(seed=args.seed, count=args.count, event=event)

    # ------------------------------------------------------------
    # Demo: 印出前 N 格 A/B 的 normal 結果 + 是否有 guaranteed / switch_track
    # - normal：顯示貓名
    # - G：顯示「保底會抽到的貓」+「跳到的位置」
    # - S：顯示「換線會抽到的貓」+「跳到的位置」
    # ------------------------------------------------------------
    max_pos = args.count  # 依你的需求：印出全部 count 格
    # max_pos = 5  # 依你的需求：印出前 20 格

    def pad_disp(text: str, width: int) -> str:
        """依終端機顯示寬度補空白（中文=2格），用來對齊。"""
        text = text or ""
        w = wcswidth(text)
        if w < 0:
            w = len(text)
        if w >= width:
            return text
        return text + " " * (width - w) 


    def fmt(node) -> str:
        """
        輸出格式（分欄位固定寬度）：
        <normal_name 固定寬> <extras 固定寬>
        例如：
        薩滿貓            [G -> 88B(空中戰艦貓咪Wunder)]
        """
        # 調整這兩個欄位寬度（是「顯示寬度」）
        NAME_W = 10     # 貓名欄寬
        EXTRA_W = 50    # extras 欄寬

        if not node:
            return pad_disp("(missing)", NAME_W) + pad_disp("", EXTRA_W)

        # (1) normal：本格正常單抽會抽到什麼
        normal_edge = (node.edges or {}).get("normal")
        normal_name = normal_edge.cat.name if (normal_edge and normal_edge.cat) else "-"

        # (2) 額外動作：G / S（目的地 + 抽到的貓）
        extra_parts = []

        g_edge = (node.edges or {}).get("guaranteed")
        if g_edge:
            g_to = g_edge.to
            g_cat = g_edge.cat.name if g_edge.cat else "-"
            extra_parts.append(f"G -> {g_to}({g_cat})")

        s_edge = (node.edges or {}).get("switch_track")
        if s_edge:
            s_to = s_edge.to
            s_cat = s_edge.cat.name if s_edge.cat else "-"
            extra_parts.append(f"S -> {s_to}({s_cat})")

        extras = f" [{', '.join(extra_parts)}]" if extra_parts else ""

        # ✅ 分別固定寬度，最後再串起來
        return pad_disp(normal_name, NAME_W) + pad_disp(extras, EXTRA_W)

    for pos in range(1, max_pos + 1):
        a_id = f"{pos}A"
        b_id = f"{pos}B"
        a = graph.nodes.get(a_id)
        b = graph.nodes.get(b_id)

        # 你原本的印法保留：左右各一欄
        # print(f"{a_id:<5}{fmt(a):<80}{b_id:<5}{fmt(b):<40}")
        # 欄位寬度你可以自己調（這些是「顯示寬度」）
        LEFT_W  = 70   # 左欄整體寬（含 a_id + fmt）
        RIGHT_W = 60   # 右欄整體寬（含 b_id + fmt）

        left  = f"{a_id:<5}{fmt(a)}"
        right = f"{b_id:<5}{fmt(b)}"

        print(f"{pad_disp(left, LEFT_W)} | {pad_disp(right, RIGHT_W)}")


    if args.export:
        scraper.export_graph_json(graph, args.export)
        print(f"\nExported: {args.export}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
