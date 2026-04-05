# BC Roll Planner

貓咪大戰爭轉蛋規劃工具 — 輸入 seed、選擇活動與目標貓咪，自動規劃最佳抽卡策略。

## 功能說明

- 選擇即將到來或歷史轉蛋活動
- 從活動卡池中選擇想要的目標貓咪（依稀有度分組）
- 輸入持有的資源（抽獎券、白金券、傳說券、貓罐頭）
- 自動計算最低成本的抽卡方案，並以表格呈現每一步的抽卡動作

## 核心演算法

規劃引擎位於 `src/features/planner/logic/core.ts`，採用 **A\* / Dijkstra** 最短路徑搜索：

- 將轉蛋軌道建模為圖（TrackGraph），每個位置為節點，抽卡動作（單抽、十連、保底、換軌）為邊
- 狀態空間：`(cursor 位置, 上一隻貓, 剩餘資源, 已命中目標 bitmask)`
- 使用 MinHeap 優先佇列，以等價成本排序展開
- 優化技巧：
  - **A\* heuristic**：剩餘目標數 × 最小單抽成本作為下界，加速收斂
  - **Dominance pruning**：對同一物理狀態，剪除被支配的 (mask, cost) 組合，避免 2^k 爆炸
- 輸出 `PlanResult`：包含每步的抽卡動作、使用資源、命中目標與總成本

## 技術棧

- React 19 + TypeScript + Vite
- Material UI
- Netlify Functions（後端 API，爬取 [bc.godfat.org](https://bc.godfat.org) 資料）

## 快速開始

```bash
npm install
npx netlify dev
```

> `netlify dev` 會同時啟動 Vite dev server 與 Netlify Functions，提供完整的本地開發環境。

## 專案結構

```
bc-roll-planner-react/
├── index.html                       # Vite SPA 入口 HTML
├── netlify.toml                     # Netlify 部署設定
├── netlify
│   └── functions                    # Netlify Functions（後端 API：抓資料、解析、組 graph）
│       ├── _lib                     # Functions 共用工具與解析模組
│       │   ├── buildGraph.ts        # 由 tracks/解析結果組出 TrackGraph（A/B 軌、保底、換軌等邊）
│       │   ├── env.ts               # Functions 端環境變數與預設值讀取
│       │   ├── http.ts              # 伺服端 HTTP 抓取工具（fetch + retry/timeout/headers）
│       │   ├── normalize.ts         # 解析結果正規化（字串清理、欄位對齊、型別轉換）
│       │   ├── parseEventCats.ts    # 解析活動頁的貓池內容（分組、稀有度 tiers、貓名/描述）
│       │   ├── parseEvents.ts       # 解析活動列表頁（upcoming/past）成 Event 清單
│       │   └── parseTrackTable.ts   # 解析轉蛋軌道表（A/B 位置、貓、保底/換軌資訊等）
│       ├── eventCats.ts             # API：回傳指定活動可抽到的貓與分組
│       ├── events.ts                # API：回傳活動列表（upcoming + past）
│       └── trackGraph.ts            # API：回傳指定活動的 TrackGraph
├── shared
│   └── models.ts                    # 前後端共用型別（Event/TrackGraph/Cat/Edge 等）
├── src
│   ├── main.tsx                     # React 入口
│   ├── app
│   │   ├── App.tsx                  # App 根元件
│   │   ├── theme
│   │   │   └── index.ts             # MUI theme
│   │   └── styles
│   │       ├── App.css              # App 全域樣式
│   │       └── index.css            # 全站基礎 CSS
│   ├── pages
│   │   ├── HomePage.tsx             # 首頁（轉向 PlannerPage）
│   │   └── PlannerPage.tsx          # 規劃頁（整合資料抓取、執行 planner、呈現結果）
│   ├── domain
│   │   ├── planner.ts               # 核心規劃演算法（A*/Dijkstra、資源成本、輸出 PlanResult）
│   │   ├── simulator.ts             # 核心模擬器（單抽/十連抽規則、走邊、更新 cursor）
│   │   └── utils.ts                 # 核心共用工具（posId/track parsing）
│   ├── features
│   │   ├── cats
│   │   │   ├── model
│   │   │   │   └── useEventCats.ts  # 取得 eventCats、分組整理
│   │   │   └── ui
│   │   │       ├── TargetCatsPicker.tsx     # 目標貓選擇器
│   │   │       └── CatSelectableItem
│   │   │           └── index.tsx            # 單一貓咪可選項目
│   │   ├── events
│   │   │   ├── model
│   │   │   │   └── useEvents.ts     # 取得活動列表（upcoming/past）
│   │   │   └── ui
│   │   │       └── EventsPicker.tsx  # 活動選擇器
│   │   ├── track-graph
│   │   │   ├── model
│   │   │   │   └── useTrackGraphs.ts # 取得 TrackGraph
│   │   │   └── ui
│   │   │       └── GraphSummaryCard.tsx # TrackGraph 摘要卡
│   │   ├── planner
│   │   │   ├── model
│   │   │   │   └── usePlannerWorker.ts # Web Worker 執行 planner
│   │   │   ├── worker
│   │   │   │   └── planner.worker.ts   # planner worker
│   │   │   └── ui
│   │   │       ├── SeedCountForm.tsx
│   │   │       ├── ResourceForm.tsx
│   │   │       ├── PlannerRunBar.tsx
│   │   │       ├── PlanResultStatsCard.tsx
│   │   │       ├── EventTrackGraphsView.tsx
│   │   │       └── ResultTable             # 規劃結果表
│   │   └── simulator
│   │       └── ui
│   │           └── SimulatorPanel.tsx       # 模擬面板
│   └── shared
│       ├── api
│       │   ├── eventCatsApi.ts         # 呼叫 eventCats function
│       │   ├── eventsApi.ts            # 呼叫 events function
│       │   ├── netlifyClient.ts        # Netlify functions HTTP client
│       │   └── trackGraphApi.ts        # 呼叫 trackGraph function
│       ├── config
│       │   ├── bcEnv.ts                # 前端環境設定（讀 Vite env）
│       │   └── dataSources.ts          # 資料來源清單
│       ├── ui
│       │   ├── Section.tsx             # 版面區塊容器
│       │   ├── ControlPanel.tsx        # 顯示區塊控制面板
│       │   ├── StickyHeader.tsx        # 吸附式 header 容器
│       │   └── NumberField.tsx         # 數字輸入元件（Base UI + MUI）
│       └── models.ts                   # re-export shared/models.ts
```

備註：`tsconfig.app.json` 設定 `@/*` alias 指向 `src/*`。
