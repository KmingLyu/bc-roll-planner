"""
取得 https://bc.godfat.org/ 上 upcoming events
"""

import argparse
from typing import Iterable, List, Optional, Dict, Tuple

import requests
from bs4 import BeautifulSoup, Tag


URL = "https://bc.godfat.org/?lang=tw&ui=tw"


def fetch_html(url: str) -> str:
    """
    取得指定 URL 的 HTML 內容。
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/143.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "zh-TW,zh;q=0.9",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.text


def make_soup(html: str) -> BeautifulSoup:
    for parser in ("lxml", "html.parser"):
        try:
            return BeautifulSoup(html, parser)
        except Exception:
            continue
    return BeautifulSoup(html, "html.parser")


def normalize_line(text: str) -> str:
    return " ".join(text.split()).strip()


def extract_upcoming_events(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """
    extract_upcoming_events 的 Docstring

    :param soup: 說明
    :type soup: BeautifulSoup
    :return: 說明
    :rtype: List[Dict[str, str]]
    """
    options = soup.select('.events optgroup[label="Upcoming:"] option')
    out: List[Dict[str, str]] = []
    seen = set()

    # 加一個從name裡面截取開始與結束日期
    # 例如：
    #   name = 2025-12-05 ~ 2025-12-22: 全新傳說稀有和超激稀有角色參戰！新世紀福音戰士合作轉蛋登場！
    #   start_date = "2025-12-05"
    #   end_date = "2025-12-22"
    def _extract_dates(name: str) -> Tuple[Optional[str], Optional[str]]:
        parts = name.split()
        if len(parts) < 1:
            return None, None
        date_part = parts[0]
        if "~" in date_part:
            start_str, end_str = date_part.split("~", 1)
            start_date = start_str.strip()
            end_date = end_str.strip().rstrip(":")
            return start_date, end_date
        else:
            single_date = date_part.strip().rstrip(":")
            return single_date, single_date

    for opt in options:
        value = (opt.get("value") or "").strip()
        name = normalize_line(opt.get_text(" ", strip=True))
        if not value or not name:
            continue
        key = (value, name)
        if key in seen:
            continue
        seen.add(key)
        start_date, end_date = _extract_dates(name)
        out.append(
            {
                "value": value,
                "name": name,
                "start_date": start_date,
                "end_date": end_date,
            }
        )

    return out


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape bc.godfat.org event info")
    parser.add_argument("--url", default=URL, help="Target URL")
    args = parser.parse_args(argv)

    html = fetch_html(args.url)
    soup = make_soup(html)

    upcoming_events = extract_upcoming_events(soup)
    if not upcoming_events:
        print("找不到 upcoming events")
        return 2

    for event in upcoming_events:
        print(
            f"{event['value']}\t{event['name']}\t{event['start_date']}\t{event['end_date']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
