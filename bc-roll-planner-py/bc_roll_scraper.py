from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from bc_roll_models import (
    Cat,
    Event,
    PickCell,
    TrackGraph,
    PositionNode,
    Edge,
    ActionType,
    parse_onclick,
    parse_pick_id,
    detect_rarity_from_classes,
    extract_jump_and_ref,
    next_pos_id,
    infer_guaranteed_to,
)

BASE_URL = "https://bc.godfat.org"
LANG_TW = "tw"
UI_TW = "tw"


class BattleCatsScraper:
    """
    bc.godfat.org Scraper（新版：輸出 TrackGraph）
    """

    def __init__(
        self,
        base_url: str = BASE_URL,
        lang: str = LANG_TW,
        ui: str = UI_TW,
        timeout: int = 30,
        headers: Optional[Dict[str, str]] = None,
        session: Optional[requests.Session] = None,
        retries: int = 3,
        backoff: float = 0.6,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.lang = lang
        self.ui = ui
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

        # ---- requests retry ----
        retry = Retry(
            total=retries,
            connect=retries,
            read=retries,
            status=retries,
            backoff_factor=backoff,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    # -------------------------
    # HTTP / Soup
    # -------------------------
    def build_tracks_url(
        self,
        seed: str,
        count: int,
        event_value: str,
    ) -> str:
        # bc.godfat 的 query 大致會長這樣：
        # ?lang=tw&ui=tw&seed=1234&count=20&event=2025-12-12_1020
        qs = f"lang={self.lang}&ui={self.ui}&seed={seed}&count={count}&event={event_value}"
        return f"{self.base_url}/?{qs}"

    def fetch_html(self, url: str) -> str:
        resp = self.session.get(url, headers=self.headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.text

    def make_soup(self, html: str) -> BeautifulSoup:
        for parser in ("lxml", "html.parser"):
            try:
                return BeautifulSoup(html, parser)
            except Exception:
                continue
        return BeautifulSoup(html, "html.parser")

    @staticmethod
    def normalize_text(text: str) -> str:
        return " ".join((text or "").split()).strip()

    # -------------------------
    # Events
    # -------------------------
    @staticmethod
    def _extract_dates_from_event_name(name: str) -> Tuple[Optional[str], Optional[str]]:
        parts = (name or "").split()
        if not parts:
            return None, None

        head = parts[:6]
        if "~" in head:
            i = head.index("~")
            if i - 1 >= 0 and i + 1 < len(head):
                start_date = head[i - 1].strip().rstrip(":")
                end_date = head[i + 1].strip().rstrip(":")
                return start_date, end_date

        single = head[0].strip().rstrip(":")
        return single, single

    def get_upcoming_events(self) -> List[Event]:
        """
        抓 Upcoming events
        """
        url = f"{self.base_url}/?lang={self.lang}&ui={self.ui}"
        html = self.fetch_html(url)
        soup = self.make_soup(html)

        # 常見結構：<select class="events"> ... <optgroup label="Upcoming:"> <option ...>
        # 用 contains 的方式抓，容錯比較好
        # 這個抓不太到，再研究看看
        # options = soup.select("select.events optgroup option")
        # 用更寬鬆的 selector
        options = soup.select('.events optgroup[label="Upcoming:"] option')

        out: List[Event] = []
        seen = set()

        for opt in options:
            value = (opt.get("value") or "").strip()
            name = self.normalize_text(opt.get_text(" ", strip=True))
            if not value or not name:
                continue

            # 只取 Upcoming（label 包含 Upcoming）
            parent = opt.find_parent("optgroup")
            label = (parent.get("label") or "") if parent else ""
            if "Upcoming" not in label:
                continue

            key = (value, name)
            if key in seen:
                continue
            seen.add(key)

            start_date, end_date = self._extract_dates_from_event_name(name)
            out.append(Event(value=value, name=name, start_date=start_date, end_date=end_date))

        return out

    def get_past_events(self, limit: int = 10) -> List[Event]:
        """
        抓 Past events
        """
        url = f"{self.base_url}/?lang={self.lang}&ui={self.ui}"
        html = self.fetch_html(url)
        soup = self.make_soup(html)

        options = soup.select('.events optgroup[label="Past:"] option')

        out: List[Event] = []
        seen = set()

        for opt in options:
            if len(out) >= limit:
                break

            value = (opt.get("value") or "").strip()
            name = self.normalize_text(opt.get_text(" ", strip=True))
            if not value or not name:
                continue

            key = (value, name)
            if key in seen:
                continue
            seen.add(key)

            start_date, end_date = self._extract_dates_from_event_name(name)
            out.append(Event(value=value, name=name, start_date=start_date, end_date=end_date))

        return out

    # -------------------------
    # Tracks table parsing -> TrackGraph
    # -------------------------
    def _find_tracks_table(self, soup: BeautifulSoup) -> Optional[Any]:
        """
        找包含 'Guaranteed' / 'Alt.' 這些表頭的 table（最接近你貼的那張）
        """
        for table in soup.find_all("table"):
            headers = [self.normalize_text(th.get_text(" ", strip=True)).lower() for th in table.find_all("th")]
            header_line = " ".join(headers)
            if "guaranteed" in header_line and "alt" in header_line:
                return table
        # fallback：就抓第一個 table
        return soup.find("table")

    def _parse_tracks_cells(self, table: Any) -> Dict[str, PickCell]:
        """
        把所有 onclick="pick('...')" 的 td 解析成 PickCell
        """
        cells: Dict[str, PickCell] = {}

        for td in table.select("td[onclick]"):
            onclick = td.get("onclick") or ""
            pick_id = parse_onclick(onclick)
            if not pick_id:
                continue

            # 只處理像 "3A", "3AG", "3AR", "3ARG" 這種
            try:
                pos, track, suffix = parse_pick_id(pick_id)
            except Exception:
                continue

            classes = td.get("class") or []
            rarity = detect_rarity_from_classes(classes)

            # 解析文字（用於抓 -> / <-）
            raw_text = self.normalize_text(td.get_text(" ", strip=True))
            jump_to, ref_from = extract_jump_and_ref(raw_text)

            # 解析 cat（若此格是 cat）
            cat: Optional[Cat] = None
            if "cat" in classes or td.find("a"):
                # 找到貓名（通常是第一個不是 🐾 的 link）
                links = td.find_all("a")
                name = ""
                desc = ""
                cat_id: Optional[int] = None

                # name / desc：用第一個有文字且不是 🐾 的 a
                for a in links:
                    txt = self.normalize_text(a.get_text(" ", strip=True))
                    if not txt or txt == "🐾":
                        continue
                    name = txt
                    desc = (a.get("title") or "").strip()
                    break

                # cat_id：從任意 href 含 /cats/{id} 的 a 抓
                for a in links:
                    href = a.get("href") or ""
                    m = re.search(r"/cats/(\d+)", href)
                    if m:
                        cat_id = int(m.group(1))
                        break

                if cat_id is not None and name:
                    cat = Cat(id=cat_id, name=name, desc=desc)

            cells[pick_id] = PickCell(
                pick_id=pick_id,
                pos=pos,
                track=track,
                suffix=suffix,
                rarity=rarity,
                cat=cat,
                jump_to=jump_to,
                ref_from=ref_from,
            )

        return cells

    def build_track_graph(self, seed: str, count: int, event: Event) -> TrackGraph:
        """
        主方法：抓取 tracks 表格 -> 解析成 TrackGraph（新格式）
        """
        url = self.build_tracks_url(seed=seed, count=count, event_value=event.value)
        html = self.fetch_html(url)
        soup = self.make_soup(html)

        table = self._find_tracks_table(soup)
        if not table:
            raise RuntimeError("找不到 tracks table（HTML 結構可能改版）")

        raw_cells = self._parse_tracks_cells(table)

        # ---- 建 nodes（只用 base: 'nA'/'nB' 當 PositionNode，其他 suffix 變成 edges 的資料來源）----
        nodes: Dict[str, PositionNode] = {}

        # 先找出所有 base key（suffix == "" 的）
        base_ids = sorted([pid for pid, c in raw_cells.items() if c.suffix == "" and c.track in ("A", "B")],
                          key=lambda x: (raw_cells[x].pos, raw_cells[x].track))

        for base_id in base_ids:
            base_cell = raw_cells[base_id]
            pos = base_cell.pos
            track = base_cell.track
            edges: Dict[ActionType, Edge] = {}

            # normal：一定存在（抽一次，拿 base_cell.cat，前進到下一格同線）
            edges["normal"] = Edge(
                action="normal",
                to=next_pos_id(pos, track),
                cat=base_cell.cat,
                cost_rolls=1,
                note="normal roll",
                ref_from=base_cell.ref_from,
                source_pick_id=base_id,
            )

            # guaranteed：看 base_id + "G"
            g_id = f"{base_id}G"
            g_cell = raw_cells.get(g_id)
            if g_cell and g_cell.cat:
                to = g_cell.jump_to or infer_guaranteed_to(pos, track)
                edges["guaranteed"] = Edge(
                    action="guaranteed",
                    to=to,
                    cat=g_cell.cat,
                    cost_rolls=11,
                    note=g_cell.jump_to and f"guaranteed {g_cell.jump_to}" or "guaranteed (inferred)",
                    ref_from=g_cell.ref_from,
                    source_pick_id=g_id,
                )

            # switch_track（R 分支）：看 base_id + "R"
            r_id = f"{base_id}R"
            r_cell = raw_cells.get(r_id)
            if r_cell and r_cell.cat:
                # 通常 R cell 會自己寫 -> 4B 之類；沒有就 fallback：下一格 + 換線
                to = r_cell.jump_to or f"{pos + 1}{'B' if track == 'A' else 'A'}"
                edges["switch_track"] = Edge(
                    action="switch_track",
                    to=to,
                    cat=r_cell.cat,
                    cost_rolls=1,
                    note=r_cell.jump_to and f"switch_track {r_cell.jump_to}" or "switch_track (fallback)",
                    ref_from=r_cell.ref_from,
                    source_pick_id=r_id,
                )

            nodes[base_id] = PositionNode(
                id=base_id,
                pos=pos,
                track=track,
                rarity=(base_cell.rarity if base_cell.rarity in ("rare", "supa", "uber_fest", "supa_fest") else None),
                edges=edges,
            )

        return TrackGraph(seed=seed, count=count, event=event, nodes=nodes, raw_cells=raw_cells)

    # -------------------------
    # Utility: export
    # -------------------------
    def export_graph_json(self, graph: TrackGraph, path: str) -> None:
        from bc_roll_models import graph_to_dict
        with open(path, "w", encoding="utf-8") as f:
            json.dump(graph_to_dict(graph), f, ensure_ascii=False, indent=2)
