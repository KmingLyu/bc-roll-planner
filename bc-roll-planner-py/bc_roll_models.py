from __future__ import annotations

import re
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Optional, Literal, Tuple, Any, Mapping


# -------------------------
# Domain models
# -------------------------
@dataclass(frozen=True)
class Cat:
    """貓咪資料"""

    id: int
    name: str
    desc: str = ""


@dataclass(frozen=True)
class Event:
    """卡池活動"""

    value: str
    name: str
    start_date: Optional[str]
    end_date: Optional[str]


# - normal: 單抽
# - guaranteed: 10 連保底+1(會換線)
# - switch_track: 換線(因為重複貓咪導致)
ActionType = Literal["normal", "guaranteed", "switch_track"]


@dataclass(frozen=True)
class Cursor:
    """
    抽卡游標 (與 event 無關，只代表位置)
    - 切換不同卡池時位置不變

    用法：
        cursor = Cursor(pos=1, track="A")
        cursor.id -> "1A"
    """

    pos: int
    track: Literal["A", "B"]

    @property
    def id(self) -> str:
        return f"{self.pos}{self.track}"


@dataclass(frozen=True)
class Edge:
    """
    一個 action 對應到一次操作的轉移規則

    核心概念(為了模擬 10連保底+1的行為):
    - rolls: 此 action 會產生幾筆「抽取結果」
      - normal: 1
      - guaranteed: 11
    - advance: 此 action 會讓 cursor「前進幾格」
      - normal: 1
      - guaranteed: 10 (最後落點由第一格資訊決定)

    to 的語意:
    - to 是此 action 結束後「游標要停在哪個位置（例如 '12A'）」
    - 如果 HTML 能明確告訴你保底最後位置,
      scraper 把它填入 to, 讓 simulator 直接使用這個落點
    - 若 HTML 沒有告訴你保底最後位置, 就會在 simulator 用 fallback 推算(但基本上都有)
    """

    action: ActionType
    to: str
    cat: Optional[Cat] = None

    rolls: int = 1
    advance: int = 1

    cost_rolls: int = 1  # 感覺多餘，但先保留

    note: str = ""
    ref_from: Optional[str] = None
    source_pick_id: Optional[str] = None  # 例如 "3AG" / "3AR"


# 注意這裡的「稀有度」指的是序列上所設定的稀有度，而非貓咪本身的稀有度
Rarity = Literal["rare", "supa", "uber_fest", "supa_fest"]


@dataclass(frozen=True)
class PositionNode:
    """
    一個位置狀態，例如 "3A" / "15B"
    edges[action] 描述：在這個位置「採取某種抽法」會抽到什麼、並且移動到哪。
    """

    id: str
    pos: int
    track: Literal["A", "B"]
    rarity: Optional[Rarity] = None
    # edges: Dict[ActionType, Edge] = None

    # 避免 edges 預設 None（使用時一直要 or {}）
    # 用 Mapping 表達「查表用，不希望 runtime 被 mutate」
    # **這裡看不太懂，晚點再研究**
    edges: Mapping[ActionType, Edge] = field(default_factory=dict)


@dataclass(frozen=True)
class PickCell:
    """
    解析 HTML 用的中介資料：一個 td（onclick pick('...')）對應的內容
    """

    pick_id: str  # e.g. "3A", "3AG", "3AR", "3ARG"
    pos: int
    track: Literal["A", "B"]
    suffix: str  # "", "G", "R", "RG", "X", "GX"...（我們主要用到 "", "G", "R", "RG"）
    rarity: Optional[str] = None
    cat: Optional[Cat] = None
    jump_to: Optional[str] = None  # "-> 13B"
    ref_from: Optional[str] = None  # "<- 12A"


@dataclass
class TrackGraph:
    """
    一個 event 下的查表圖
    - 同一個 seed 在不同 event 會有不同的 TrackGraph
    - 模擬器會用 Cursor.id（如 '12A'）去查 nodes['12A']
    """

    seed: str
    count: int
    event: Event
    nodes: Dict[str, PositionNode]
    raw_cells: Dict[str, PickCell]  # debug / 追查用（保留所有 pick_id）


# -------------------------
# Helpers
# -------------------------
_PICK_ID_RE = re.compile(r"^(\d+)([AB])(.*)$")  # 1A, 1AG, 1BR
_ONCLICK_RE = re.compile(r"pick\('([^']+)'\)")  # pick('3A'), pick('12BG'), ...
_CATS_ID_RE = re.compile(r"/cats/(\d+)")  # /cats/123
_JUMP_RE = re.compile(r"->\s*([0-9]+[AB])")  # -> 13B
_REF_RE = re.compile(r"<-\s*([0-9]+[AB])")  # <- 12A

_RARITY_CLASSES = ("uber_fest", "supa_fest", "supa", "rare")  # 由強到弱（先抓到先算）
# 有些 td class 可能會是 "cat pick rare next_position" 或 "score pick supa"
# 我們只要找出其中的 rare/supa/uber_fest/supa_fest


def other_track(track: Literal["A", "B"]) -> Literal["A", "B"]:
    return "B" if track == "A" else "A"


def next_pos_id(pos: int, track: Literal["A", "B"]) -> str:
    return f"{pos + 1}{track}"


def infer_guaranteed_to(pos: int, track: Literal["A", "B"]) -> str:
    """
    bc.godfat 的 11 連（含保底）通常會前進 10 格並換線：
      nA -> (n+10)B
      nB -> (n+10)A
    若 HTML 沒給 arrow，就用這個作 fallback。
    """
    return f"{pos + 10}{other_track(track)}"


def parse_pick_id(pick_id: str) -> Tuple[int, Literal["A", "B"], str]:
    """
    解析像 "3A", "3AG", "3AR" 這類 pick_id
    回傳 (pos, track, suffix) = (3, "A", "G")
    """
    m = _PICK_ID_RE.match(pick_id)
    if not m:
        raise ValueError(f"Invalid pick_id: {pick_id}")
    pos = int(m.group(1))
    track = m.group(2)  # type: ignore
    suffix = m.group(3) or ""
    return pos, track, suffix


def parse_pos_id(pos_id: str) -> Cursor:
    """
    解析位置字串（只能是 base：例如 "3A"/"15B"）
    用於 simulator：
      cursor = parse_pos_id("12A") -> Cursor(pos=12, track="A")
    """
    pos, track, suffix = parse_pick_id(pos_id)
    if suffix:
        raise ValueError(f"Invalid pos_id (suffix not allowed): {pos_id}")
    return Cursor(pos=pos, track=track)


def parse_onclick(onclick: str) -> Optional[str]:
    m = _ONCLICK_RE.search(onclick or "")
    return m.group(1) if m else None


def detect_rarity_from_classes(classes: List[str]) -> Optional[str]:
    s = set(classes or [])
    for r in _RARITY_CLASSES:
        if r in s:
            return r
    return None


def extract_jump_and_ref(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    從 td 的文字抓出：
      - "-> 13B" 這種 jump
      - "<- 12A" 這種 ref
    """
    jump_to = None
    ref_from = None
    if text:
        jm = _JUMP_RE.search(text)
        if jm:
            jump_to = jm.group(1)
        rm = _REF_RE.search(text)
        if rm:
            ref_from = rm.group(1)
    return jump_to, ref_from


def pickcell_to_dict(cell: PickCell) -> Dict[str, Any]:
    # Cat 是 dataclass；asdict 會展開，這裡不特別處理也可以
    return asdict(cell)


def graph_to_dict(g: TrackGraph) -> Dict[str, Any]:
    """
    匯出 JSON 用
    """
    return {
        "seed": g.seed,
        "count": g.count,
        "event": asdict(g.event),
        "nodes": {
            k: {
                "id": v.id,
                "pos": v.pos,
                "track": v.track,
                "rarity": v.rarity,
                "edges": {a: asdict(e) for a, e in (v.edges or {}).items()},
            }
            for k, v in g.nodes.items()
        },
        "raw_cells": {k: pickcell_to_dict(v) for k, v in g.raw_cells.items()},
    }
