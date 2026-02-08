# BC Roll Planner React 架構 v1

```markdown
bc-roll-planner-react/
├── index.html                       # Vite SPA 入口 HTML（掛載 root、載入 main.tsx、設定 title/favicon 等）
├── netlify.toml                     # Netlify 部署設定（build/redirects/functions 設定與環境變數等）
├── netlify
│   └── functions                    # Netlify Functions（後端 API：抓資料、解析、組 graph）
│       ├── _lib                     # Functions 共用工具與解析模組
│       │   ├── buildGraph.ts        # 由 tracks/解析結果組出 TrackGraph（A/B 軌、保底、換軌等邊）
│       │   ├── env.ts               # Functions 端環境變數與預設值讀取（例如 base_url/lang/ui 等）
│       │   ├── http.ts              # 伺服端 HTTP 抓取工具（fetch + retry/timeout/headers 等）
│       │   ├── normalize.ts         # 解析結果正規化（字串清理、欄位對齊、型別轉換）
│       │   ├── parseEventCats.ts    # 解析活動頁的貓池內容（分組、稀有度 tiers、貓名/描述）
│       │   ├── parseEvents.ts       # 解析活動列表頁（upcoming/past）成 Event 清單
│       │   └── parseTrackTable.ts   # 解析轉蛋軌道表（A/B 位置、貓、保底/換軌資訊等）
│       ├── eventCats.ts             # API：回傳指定活動可抽到的貓與分組（供前端 TargetCatsPicker）
│       ├── events.ts                # API：回傳活動列表（upcoming + past）供前端選擇
│       └── trackGraph.ts            # API：回傳指定活動的 TrackGraph（供 planner/simulator 使用）
├── shared
│   └── models.ts                    # 前後端共用型別（Event/TrackGraph/Cat/Edge 等單一真實來源）
├── src
│   ├── main.tsx                     # React 入口（createRoot、掛載 App、注入 providers）
│   ├── app
│   │   ├── App.tsx                  # App 根元件（頁面框架）
│   │   ├── theme
│   │   │   └── index.ts             # MUI theme
│   │   └── styles
│   │       ├── App.css              # App 全域樣式（少量補強與覆寫）
│   │       └── index.css            # 全站基礎 CSS（reset、字體、body 背景等）
│   ├── pages
│   │   ├── HomePage.tsx             # 首頁（目前轉向 PlannerPage）
│   │   └── PlannerPage.tsx          # 規劃頁（整合資料抓取、執行 planner、呈現結果）
│   ├── domain
│   │   ├── planner.ts               # 核心規劃演算法（資源成本、策略、輸出 PlanResult）
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
│   │   │       └── EventsPicker.tsx # 活動選擇器
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
│   │   │       └── ResultTable          # 規劃結果表（可擴充）
│   │   └── simulator
│   │       └── ui
│   │           └── SimulatorPanel.tsx   # 模擬面板
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

備註
- `tsconfig.app.json` 設定 `@/*` alias 指向 `src/*`，跨層級引用會比較乾淨。
