# 貓咪大戰爭抽卡規劃

這是一個用來解析 `bc.godfat.org` 抽卡軌道（A/B 線、保底 10 連、重複 rare 換線）的工具集，包含：

- **Scraper**：抓取指定 `seed + event + count` 的軌道表，解析成結構化 `TrackGraph`
- **Simulator**：依據一串「切卡池 + 單抽/十連」動作，逐抽模擬走位與抽到的貓
- **Planner**：在多卡池、多資源限制下，用 Dijkstra 搜尋「最小成本」達成目標貓（以 cat_id 表示）


## 專案結構

- `bc_roll_models.py`  
  Domain models 與解析 helper  
  - `Cat / Event / Cursor / Edge / PositionNode / PickCell / TrackGraph`
  - `parse_pick_id / parse_pos_id / extract_jump_and_ref / detect_rarity_from_classes`
  - `graph_to_dict()`：匯出 TrackGraph 為可 JSON 序列化 dict

- `bc_roll_scraper.py`  
  `BattleCatsScraper`：抓 HTML + 解析 tracks table -> `TrackGraph`
  - `get_upcoming_events()` / `get_past_events(limit)`
  - `build_track_graph(seed, count, event)`：核心建圖
  - `export_graph_json(graph, path)`：輸出 JSON

- `bc_roll_simulator.py`  
  `simulate(graphs_by_event, actions, start_pos_id)`：執行逐抽模擬  
  - `parse_actions()`：把 list[dict] 轉 `SimAction`
  - `estimate_required_counts()`：依 plan 粗估需要的 count（+20 buffer）

- `bc_roll_planner.py`  
  `plan_min_cost(...)`：用 Dijkstra 以 lexicographic 成本向量做最小化搜尋  
  - 支援資源：金券 / 白金券 / 傳說券 / 貓罐頭（單抽、十連）
  - `PlannerConfig`：可限制每個 pool 允許的 actions、權重、搜尋上限
  - `build_events()`：用 dict 快速建立 `EventMeta`

- `main.py`  
  建圖 CLI：抓單一 event 的 TrackGraph 並印出 A/B 軌道摘要（含 G/S）
- `get_events.py`  
  Events CLI：列出 upcoming 或 past events（包含 value / name / start_date / end_date）
- `run_sim_demo.py`  
  Demo：讀 plan 檔（JSON/JSONL）-> 自動抓 event graphs -> simulate -> 印出逐抽結果
- `run_planner.py`  
  跑 planner：讀 test case JSON -> 建 graphs -> plan_min_cost -> 印出 plan summary + 每抽展平表

---

## 環境需求與安裝

建議 Python 3.10+（3.11/3.12 也可）。

安裝依賴（請依你自己的環境管理方式）：

```bash
pip install requests beautifulsoup4 urllib3 wcwidth
````

> `bc_roll_scraper.py` 會嘗試用 `lxml` parser；若你要更穩定解析可額外裝：

```bash
pip install lxml
```

---

## 取得活動列表（events）

### 1) Upcoming events

```bash
python get_events.py --event_type upcoming --lang tw --ui tw
```

### 2) Past events（最多抓 N 個）

```bash
python get_events.py --event_type past --limit 20 --lang tw --ui tw
```

輸出格式會列出方便複製的：

* `value`: event_value（後續建圖用）
* `name`: event 名稱（含日期範圍時會嘗試解析 start/end）

---

## 建圖（TrackGraph）

`main.py` 會抓指定 seed + event + count，建立 `TrackGraph` 並印出每格 A/B 的摘要：

* normal 抽到的貓
* 是否有 `G -> 落點(保底貓)`
* 是否有 `S -> 落點(換線貓)`

### 範例

```bash
python main.py --seed 1234 --event 2025-12-12_1020 --count 120
```

### 輸出 JSON（可選）

```bash
python main.py --seed 1234 --event 2025-12-12_1020 --count 120 --export graph_1234_1020.json
```

---

## 模擬（Simulator）

### plan 檔格式（JSON / JSONL）

* `.json`：整個檔案是一個 array
* `.jsonl`：一行一個 dict

每個動作 dict 必須包含：

* `event_value`: 字串
* `method`: `"single"` 或 `"ten"`

#### JSON 範例（plan.json）

```json
[
  {"event_value": "2025-12-12_1020", "method": "ten"},
  {"event_value": "2025-12-12_1019", "method": "single"},
  {"event_value": "2025-12-12_1019", "method": "single"},
  {"event_value": "2025-12-12_1019", "method": "ten"}
]
```

#### JSONL 範例（plan.jsonl）

```json
{"event_value":"2025-12-12_1020","method":"ten"}
{"event_value":"2025-12-12_1019","method":"single"}
{"event_value":"2025-12-12_1019","method":"single"}
{"event_value":"2025-12-12_1019","method":"ten"}
```

### 直接跑 demo（會自動抓 events + 建 graphs + simulate）

```bash
python run_sim_demo.py --plan-file plan.json --seed 1234 --start 1A
```

* `--count` 可不填：會用 `estimate_required_counts(actions)` 自動推一個最小值（再 +20 buffer）
* 若網站抓不到 upcoming events，仍會用 plan 裡的 `event_value` 建圖（name/date 會缺）

---

## 規劃（Planner）

Planner 用 `run_planner.py`，輸入是一個「test case JSON」，包含：

* `seed`
* `start_pos_id`（可選，預設 `1A`）
* `count`（建圖用，建議 >= 需要的游標範圍）
* `targets`：目標貓（建議直接用 `cat_id` int）
* `resources`：資源上限
* `events`：你要讓 planner 可使用的卡池清單（每個含 pool_type）

### test case 範例（test_case_01.json）

```json
{
  "seed": "1234",
  "start_pos_id": "1A",
  "count": 140,
  "targets": [726, 706],
  "resources": {
    "tickets": 10,
    "platinum_tickets": 1,
    "legend_tickets": 0,
    "food": 3000
  },
  "events": [
    {
      "event_value": "2025-12-12_1019",
      "name": "Some normal pool event",
      "pool_type": "normal"
    },
    {
      "event_value": "2025-12-12_1020",
      "name": "Some platinum pool event",
      "pool_type": "platinum"
    }
  ]
}
```

### 執行

```bash
python run_planner.py test_case_01.json
```

輸出包含：

* `Success / Targets hit / Targets missing / Final cursor`
* 成本向量（equivalent_cost、food_used、tickets_used、platinum_used、legend_used）
* Step summary 表（每步的 event/pool/resource/method/cursor 變化）
* Draws 展平表（每一抽都標示：event/pool/resource/method/used/cat/pos）

---

## 重要概念說明（快速）

### 1) TrackGraph / PositionNode / Edge

* `TrackGraph.nodes["12A"]` 是一個位置
* `PositionNode.edges` 可能包含：

  * `normal`：一般單抽
  * `switch_track`：rare 重複時換線抽（R）
  * `guaranteed`：十連保底的第 11 隻（AG）

### 2) 10 連的落點

* 若起點存在 `guaranteed edge`，則：

  * 先做 10 次單抽規則
  * 再追加第 11 隻（起點 G 欄）
  * **最終 cursor** 使用 `guaranteed edge.to`
* 若起點沒有 `guaranteed edge`：就只有 10 抽，不做保底結算落點

### 3) count 要設多大？

* 建議：

  * Simulator：用 `estimate_required_counts(actions)` 自動估（再 +20）
  * Planner：你應該保守給更大一點（例如 120~200），避免目標落在更後面的 cursor

---
