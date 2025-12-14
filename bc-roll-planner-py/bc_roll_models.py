from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Literal, Tuple, Any


# -------------------------
# Domain models
# -------------------------
@dataclass(frozen=True)
class Cat:
    id: int
    name: str
    desc: str = ""


@dataclass(frozen=True)
class Event:
    value: str
    name: str
    start_date: Optional[str]
    end_date: Optional[str]

# 注意這裡的「稀有度」指的是序列上所設定的稀有度，而非貓咪本身的稀有度
Rarity = Literal["rare", "supa", "uber_fest", "supa_fest"] 
ActionType = Literal["normal", "guaranteed", "switch_track"]

@dataclass(frozen=True)
class Edge:
    """
    一個 action = 一條邊（抽法）
    - normal：單抽（或稀有券/白金券那種 1 次動作）
    - guaranteed：11 連保底（cost_rolls 通常 11）
    - switch_track：因為重複貓咪（R 分支）導致換線的結果（仍然是 1 次抽）
    """
    action: ActionType  
    to: str 
    cat: Optional[Cat] = None
    cost_rolls: int = 1
    note: str = "" 
    ref_from: Optional[str] = None 
    source_pick_id: Optional[str] = None # 例如 "3AG" / "3AR"


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
    edges: Dict[ActionType, Edge] = None


@dataclass(frozen=True)
class PickCell:
    """
    解析 HTML 用的中介資料：一個 td（onclick pick('...')）對應的內容
    """
    pick_id: str                 # e.g. "3A", "3AG", "3AR", "3ARG"
    pos: int
    track: Literal["A", "B"]
    suffix: str                  # "", "G", "R", "RG", "X", "GX"...（我們主要用到 "", "G", "R", "RG"）
    rarity: Optional[str] = None
    cat: Optional[Cat] = None
    jump_to: Optional[str] = None    # "-> 13B"
    ref_from: Optional[str] = None   # "<- 12A"


@dataclass
class TrackGraph:
    seed: str
    count: int
    event: Event
    nodes: Dict[str, PositionNode]
    raw_cells: Dict[str, PickCell]   # debug / 追查用（保留所有 pick_id）


# -------------------------
# Helpers
# -------------------------
_PICK_ID_RE = re.compile(r"^(\d+)([AB])(.*)$")
_ONCLICK_RE = re.compile(r"pick\('([^']+)'\)")
_CATS_ID_RE = re.compile(r"/cats/(\d+)")
_JUMP_RE = re.compile(r"->\s*([0-9]+[AB])")
_REF_RE = re.compile(r"<-\s*([0-9]+[AB])")

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
    m = _PICK_ID_RE.match(pick_id)
    if not m:
        raise ValueError(f"Invalid pick_id: {pick_id}")
    pos = int(m.group(1))
    track = m.group(2)  # type: ignore
    suffix = m.group(3) or ""
    return pos, track, suffix


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
    d = asdict(cell)
    # Cat 是 dataclass；asdict 會展開，這裡不特別處理也可以
    return d


def graph_to_dict(g: TrackGraph) -> Dict[str, Any]:
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
