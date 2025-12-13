"""
取得 https://bc.godfat.org/ 上 upcoming events
並提供可擴充的 Scraper class（未來可加入貓咪列表等功能）
"""

import re
import argparse
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Literal

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://bc.godfat.org"
LANG_TW = "tw"
# DEFAULT_URL = "https://bc.godfat.org/?lang=tw&ui=tw"
# DEFAULT_URL = "https://bc.godfat.org/?seed=1234&lang=tw&ui=tw&count=10"


@dataclass(frozen=True)
class Cat:
    id: int
    name: str


@dataclass(frozen=True)
class Event:
    value: str
    name: str
    start_date: Optional[str]
    end_date: Optional[str]


@dataclass(frozen=True)
class GachaPick:
    line: str  # "A" or "B"
    pos: int  # 1-based
    cat: Cat
    event: Event


class BattleCatsScraper:
    """
    用來爬取 bc.godfat.org 的資料。

    設計目標：
    - 維持「抓 HTML」「解析 soup」「抽取不同類型資料」的分層
    - 後續新增功能（如貓咪列表、卡池資訊等）只需要新增 method
    """

    def __init__(
        self,
        base_url: str = BASE_URL,
        lang: str = "tw",
        timeout: int = 30,
        headers: Optional[Dict[str, str]] = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.base_url = base_url
        self.lang = lang
        self.timeout = timeout
        self.session = session or requests.Session()
        self.headers = headers or {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/143.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "zh-TW,zh;q=0.9",
        }

    # -------------------------
    # HTTP / Parsing layer
    # -------------------------
    def fetch_html(self, url: Optional[str] = None) -> str:
        """
        取得指定 URL 的 HTML 內容。若未給 url，使用 self.base_url。
        """
        target = url or f"{self.base_url}/?lang={self.lang}"
        resp = self.session.get(target, headers=self.headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.text

    def make_soup(self, html: str) -> BeautifulSoup:
        """
        建立 BeautifulSoup 物件，優先使用 lxml，失敗則 fallback 到 html.parser。
        """
        for parser in ("lxml", "html.parser"):
            try:
                return BeautifulSoup(html, parser)
            except Exception:
                continue
        return BeautifulSoup(html, "html.parser")

    @staticmethod
    def normalize_line(text: str) -> str:
        return " ".join(text.split()).strip()

    # -------------------------
    # Extract layer (business logic)
    # -------------------------
    @staticmethod
    def _extract_dates_from_event_name(
        name: str,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        從 event 名稱開頭解析日期範圍。
        例如：
          '2025-12-05 ~ 2025-12-22: ...' -> ('2025-12-05', '2025-12-22')
          '2025-12-05: ...' -> ('2025-12-05', '2025-12-05')
        """
        parts = name.split()
        if not parts:
            return None, None

        # 你的資料格式常見：YYYY-MM-DD 或 YYYY-MM-DD ~ YYYY-MM-DD:
        # 但也有可能中間用空白隔開 "~"，
        # 因此用更穩健的方式：先取前 5 個 token 內看看是否出現 "~"
        head = parts[:5]

        if "~" in head:
            tilde_idx = head.index("~")
            if tilde_idx - 1 >= 0 and tilde_idx + 1 < len(head):
                start_date = head[tilde_idx - 1].strip().rstrip(":")
                end_date = head[tilde_idx + 1].strip().rstrip(":")
                return start_date, end_date

        # 沒看到 "~"：就把第一個 token 當成日期
        single = head[0].strip().rstrip(":")
        return single, single

    def get_upcoming_events(self, url: Optional[str] = None) -> List[Event]:
        """
        抓取 Upcoming events（Upcoming: optgroup 下面的 option）。
        """
        target_url = url or f"{self.base_url}/?lang={self.lang}"
        html = self.fetch_html(target_url)
        soup = self.make_soup(html)

        # 取得 upcoming events
        options = soup.select('.events optgroup[label="Upcoming:"] option')

        out: List[Event] = []
        seen = set()

        for opt in options:
            value = (opt.get("value") or "").strip()
            name = self.normalize_line(opt.get_text(" ", strip=True))
            if not value or not name:
                continue

            key = (value, name)
            if key in seen:
                continue
            seen.add(key)

            # 從 name 裡面截取 event 開始與結束日期
            start_date, end_date = self._extract_dates_from_event_name(name)

            out.append(
                Event(
                    value=value,
                    name=name,
                    start_date=start_date,
                    end_date=end_date,
                )
            )

        return out

    def get_cat_list(
        self,
        seed: str,
        count: int,
        # event: str = "",
        event: Event = None,
        # url: Optional[str] = None,
        # sort_by: str = "pos_line",  # "pos_line" | "line_pos" | "none"
    ) -> Dict[Literal["A", "B"], List[GachaPick]]:
        """
        回傳：
        {
          "A": [GachaPick(...), ...],
          "B": [GachaPick(...), ...]
        }
        """
        # # 組 URL
        # if url:
        #     target_url = url
        # else:
        #     qs = f"lang={self.lang}&seed={seed}&count={count}"
        #     if event:
        #         qs += f"&event={event.value}"
        #     target_url = f"{self.base_url}/?{qs}"

        # 先預設用 base_url 且 event 不得為空
        if event is None:
            raise ValueError("event 參數不得為空")
        qs = f"lang={self.lang}&seed={seed}&count={count}&event={event.value}"
        target_url = f"{self.base_url}/?{qs}"

        html = self.fetch_html(target_url)
        soup = self.make_soup(html)

        # 只抓有 pick 的格子（中間那些空 td.cat 會被排除）
        cells = soup.select("td.cat.pick")

        # pick('1A') / pick('2B') ... 取出 pos 與 line
        pick_re = re.compile(r"pick\('(\d+)([AB])'\)")
        # 從 href 解析 /cats/{id}
        catid_re = re.compile(r"/cats/(\d+)")

        result: Dict[Literal["A", "B"], List[GachaPick]] = {"A": [], "B": []}
        seen = set()

        for td in cells:
            onclick = td.get("onclick") or ""
            m = pick_re.search(onclick)
            if not m:
                continue

            pos = int(m.group(1))  # 1-based
            line = m.group(2)  # "A" or "B"
            if line not in ("A", "B"):
                continue

            links = td.find_all("a")
            if not links:
                continue

            # name：第一個 <a> 通常就是貓名
            name = self.normalize_line(links[0].get_text(" ", strip=True))

            # id：從任一個含 /cats/{id} 的 <a href> 抓出來（通常是 🐾 那個）
            cat_id: Optional[int] = None
            for a in links:
                href = a.get("href") or ""
                mm = catid_re.search(href)
                if mm:
                    cat_id = int(mm.group(1))
                    break

            if cat_id is None or not name:
                continue

            key = (line, pos, cat_id, name)
            if key in seen:
                continue
            seen.add(key)
            cat = Cat(id=cat_id, name=name)
            gacha_pick = GachaPick(
                line=line,
                pos=pos,
                cat=cat,
                event=event,
            )
            result[line].append(gacha_pick)

        # 保證順序：A1..An、B1..Bn（依 pos 排序）
        result["A"].sort(key=lambda x: x.pos)
        result["B"].sort(key=lambda x: x.pos)

        return result

    def get_by_position(
        self,
        cats: Dict[str, List[Dict[str, str]]],
        seq: str,
        pos: int,
    ) -> Optional[Dict[str, str]]:
        """
        小工具：用「網站語意」取資料，例如 A7 / B3。

        - seq: "A" 或 "B"
        - pos: 1-based（與網站一致），例如 A1 就是 pos=1

        回傳：{"pos": 7, "id": "...", "name": "..."} 或 None（找不到）
        """
        seq = seq.upper().strip()
        if seq not in cats:
            return None
        if pos <= 0:
            return None

        # cats[seq] 已依 pos 排序，可直接掃描；量很小時這樣就夠了
        for item in cats[seq]:
            if item.get("pos") == pos:
                return item
        return None

    def get_gacha_pools(self, url: Optional[str] = None) -> List[Dict[str, str]]:
        """
        （預留）取得卡池/轉蛋列表（若網站有對應資料）。
        """
        raise NotImplementedError("get_gacha_pools 尚未實作")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape bc.godfat.org event info")
    parser.add_argument("--url", default=BASE_URL, help="Target URL")
    args = parser.parse_args(argv)

    scraper = BattleCatsScraper(base_url=args.url, lang=LANG_TW)
    upcoming_events = scraper.get_upcoming_events()
    target_event: Optional[Event] = None
    for event in upcoming_events:
        if event.value == "2025-12-12_1020":
            target_event = event
            break
        # print(f"{event.value}\t{event.name}\t{event.start_date}\t{event.end_date}")
    # event = upcoming_events[0] if upcoming_events else None
    cats = scraper.get_cat_list(seed="1234", count=100, event=target_event)

    print(cats["A"][0].event.name)
    for i in range(len(cats["A"])):
        line_A_pick = cats["A"][i]
        line_B_pick = cats["B"][i]

        # print(
        #     f"A{line_A_pick.pos}\t{line_A_pick.cat.id}\t{line_A_pick.cat.name}\t"
        #     f"B{line_B_pick.pos}\t{line_B_pick.cat.id}\t{line_B_pick.cat.name}"
        # )
        # 根據資料長度調整輸出格式
        print(
            f"A{line_A_pick.pos:<3}\t{line_A_pick.cat.id:<5}\t{line_A_pick.cat.name:<15}\t"
            f"B{line_B_pick.pos:<3}\t{line_B_pick.cat.id:<5}\t{line_B_pick.cat.name:<15}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
