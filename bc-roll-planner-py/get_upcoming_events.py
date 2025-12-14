from __future__ import annotations

import argparse
from typing import Optional, List

from bc_roll_scraper import BattleCatsScraper


def main(argv: Optional[List[str]] = None) -> int:
    # 取得 upcoming events 的 value/name/start_date/end_date
    parser = argparse.ArgumentParser(description="Get upcoming events from bc.godfat.org")
    parser.add_argument("--lang", default="tw", help="lang param")
    parser.add_argument("--ui", default="tw", help="ui param")
    parser.add_argument("--base-url", default="https://bc.godfat.org", help="Base url")
    args = parser.parse_args(argv)
    print(args)

    scraper = BattleCatsScraper(base_url=args.base_url, lang=args.lang, ui=args.ui)
    events = scraper.get_upcoming_events()
    print("Upcoming Events:")
    for event in events:
        # 印成一個好複製value的格式
        print(
            f"- value: {event.value}\n"
            f"  name: {event.name}\n"
            f"  start_date: {event.start_date}\n"
            f"  end_date: {event.end_date}\n"
        )

    return 0

if __name__ == "__main__":
    raise SystemExit(main())