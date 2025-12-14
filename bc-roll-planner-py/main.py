from __future__ import annotations

import argparse
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

    # ---- Demo: 印出前 N 格 A/B 的 normal 結果 + 是否有 guaranteed / switch_track ----
    max_pos = min(args.count, 20)
    for pos in range(1, max_pos + 1):
        a_id = f"{pos}A"
        b_id = f"{pos}B"
        a = graph.nodes.get(a_id)
        b = graph.nodes.get(b_id)

        def fmt(node):
            if not node:
                return "(missing)"
            e = node.edges.get("normal")
            name = e.cat.name if (e and e.cat) else "-"
            extra = []
            if "guaranteed" in node.edges:
                extra.append("G")
            if "switch_track" in node.edges:
                extra.append("S")  # switch_track
            return f"{name}{' [' + ','.join(extra) + ']' if extra else ''}"

        print(f"{a_id:<4} {fmt(a):<28} | {b_id:<4} {fmt(b):<28}")

    if args.export:
        scraper.export_graph_json(graph, args.export)
        print(f"\nExported: {args.export}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
