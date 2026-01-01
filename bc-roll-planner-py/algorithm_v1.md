下面先給你「大方向 + 演算法選型」，我會把它設計成一個**可保證找到最省資源解**（在定義好「省」的衡量方式後），而且能直接吐出你要的 `plan / 消耗 / 最終抽到的貓`。

---

## 大方向：把抽卡當成「狀態空間的最短路徑問題」

你現在的 `scraper -> TrackGraph` 與 `simulator` 已經把「抽卡結果」做成**可查表、可決定性模擬**：

* 狀態主要由：

  1. **游標** `cursor.id`（例如 `12A`）
  2. **上一抽的貓** `prev_cat_id`（影響 rare 重複換線規則）
  3. **資源剩餘**（金券、貓罐頭）
  4. **目標完成度**（目標貓咪清單已達成哪些）

* 每一步決策是：

  * 選 **卡池 event**
  * 選 **抽法**：

    * `ticket_single`（金券單抽，不能十連）
    * `food_single`（貓罐頭單抽，150）
    * `food_ten`（貓罐頭十連，1500；若該起點有 guaranteed edge 則產生第 11 隻並結算落點）

每個決策都會透過你現有的 `simulate` 規則（或等價的「單步/十步」模擬）得到**下一個狀態**與**抽到的貓**。

所以整題可以轉成：

> 從起始狀態走到「目標全部收集完成」的狀態，找一條**總成本最小**的路徑。

---

## 我會採用的核心演算法：Dijkstra / Uniform-Cost Search（可加快成 A*）

### 1) 成本怎麼定義（很重要）

你說「最少的資源」且資源有兩種，我會用一個清楚且實用的排序方式（可保證一致性）：

**主要目標：最小化「貓罐頭等價成本」**

* 貓罐頭：照實際消耗計算
* 金券：視為「等價 150 罐頭」（因為一張券就是一抽，罐頭單抽也是 150）

所以：

* 金券單抽成本 = 150
* 罐頭單抽成本 = 150
* 罐頭十連成本 = 1500（若有保底則等價 11 抽、但成本仍是 1500）

**同成本時的 tie-break（次要目標）**我會再依序偏好：

1. 罐頭消耗更少（留罐頭彈性）
2. 金券消耗更少

> 這樣你會得到「總體最省」而且策略偏好也合理。
> 若你之後想改成「先省罐頭、金券能用就用」也很好改，只要換排序規則。

### 2) 為什麼用 Dijkstra

* 每一步成本都是非負數（150 / 1500 / 150 等價）
* 我們要保證找到全局最小成本解
* Dijkstra（或 Uniform-Cost Search）就是最標準、最穩的解法

若你覺得狀態大、想更快，我可以再加一個很安全的 heuristic 變 A*：

* `h = 剩餘目標數量 * 150`（樂觀下界：每隻至少一抽）
  這個 heuristic 不會高估，所以仍保證最優解。

---

## 狀態設計（planner 會用這個當節點）

我會用類似下面的 state（概念）：

* `cursor_id: str`（例如 `"1A"`）
* `prev_cat_id: Optional[int]`
* `tickets_left: int`
* `food_left: int`
* `mask: int`（bitmask，表示目標貓已收集哪些）
* （不用把 event 放進 state，因為每一步都能自由選卡池，切換卡池不改 cursor）

目標狀態：`mask == all_targets_mask`

---

## 邊（可做的動作）怎麼產生

對每個 state，我會展開下列可能動作（你的「卡池清單」有幾個 event，就展開幾個）：

1. **金券單抽**（若 `tickets_left >= 1`）

* 對某個 event，取 `graph.nodes[cursor_id]`
* 用 `choose_edge_for_single_draw(node, prev_cat_id)` 決定走 normal 或 switch_track
* 得到抽到的貓、下一格 cursor、更新 prev、更新 mask
* 成本：等價 150；資源更新：tickets - 1

2. **罐頭單抽**（若 `food_left >= 150`）

* 同上，但資源更新：food - 150

3. **罐頭十連**（若 `food_left >= 1500`）

* 在同一 event 下，連做 10 次「單抽規則」推進 cursor/prev
* 若起點有 `guaranteed edge`：再加第 11 隻、並把 cursor 結算到 `g_edge.to`
* 成本：1500；資源更新：food - 1500
* 同時會累積 10~11 隻貓到「結果清單」中（用來輸出最後抽到什麼）

---

## 效能：我會加快的關鍵（避免爆炸）

1. **轉移結果快取（cache）**

* `single_cache[(event, cursor_id, prev_cat_id)] -> (next_cursor_id, new_prev, gained_mask, records...)`
* `ten_cache[(event, cursor_id, prev_cat_id)] -> (...)`
  這會讓 planner 展開時幾乎是 O(1)。

2. **支配剪枝（domination pruning）**
   對相同 `(cursor_id, prev_cat_id, mask)`：

* 若我們已經用更低成本或在成本相同下擁有更多剩餘資源到達過，就可以丟掉較差的狀態。

3. **搜尋上界**
   最多能走的步數其實被資源限制住：

* 單抽最多 `tickets + floor(food/150)` 次
* 十連最多 `floor(food/1500)` 次
  這讓整個狀態空間是可控的。

---

## 輸出格式（你會拿到什麼）

規劃器找到最優路徑後會輸出：

1. `plan`：一連串動作（每步包含 event、resource、method）

   * 例如：

     * `{"event_value":"...", "resource":"ticket", "method":"single"}`
     * `{"event_value":"...", "resource":"food", "method":"ten"}`

2. `cost_summary`

   * `tickets_used`
   * `food_used`
   * `equivalent_cost`（罐頭等價）

3. `final_draws`

   * 依序列出所有抽到的貓（可直接沿用 `DrawRecord` 欄位，或整理成簡表）
   * 同時列出「目標貓是否全達成、各目標在哪一步入手」

4. 如果資源不足無法全達成

   * 回傳「在你資源限制下能達成的最多目標」的最佳方案
   * 並清楚列出缺哪些

---

如果你接受這個方向，下一步我就會開始寫 `bc_roll_planner.py`，核心會包含：

* `PlanAction / PlanResult` dataclass
* `PlannerState`（可 hash）
* `plan_min_cost(...)`（Dijkstra / A*）
* 快取與剪枝
* 以及把結果組裝成你要的 `plan + 消耗 + 最後抽到的貓`

你不用再補任何資料；我會假設你已經有 `graphs_by_event: Dict[str, TrackGraph]`（由 scraper 建好），planner 只負責「在給定資源與目標下找最佳抽法」。
